// Client-side Google Drive upload, no backend involved. A super_admin
// "connects" Drive once (Content Settings > Google Drive) — a normal Google
// consent popup, same pattern as "Sign in with Google" — using Google
// Identity Services' token client, scoped to `drive.file` (this app can only
// see/manage files/folders IT creates, never the rest of the admin's Drive).
// That first connect auto-creates a "FMS Photos" folder with Admins/
// Vehicles/Drivers subfolders and saves their IDs to Firestore
// (settings/driveConfig — see types.ts DriveConfig), so every other upload,
// by anyone, just reads those IDs instead of touching Drive's folder APIs.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DRIVE_CONFIG_DOC_PATH, DriveConfig } from "../types";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const ROOT_FOLDER_NAME = "FMS Photos";
const SUBFOLDER_NAMES = { admin: "Admins", vehicle: "Vehicles", driver: "Drivers" } as const;

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoadPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoadPromise) {
    gisLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load Google's sign-in library."));
      document.head.appendChild(script);
    });
  }
  return gisLoadPromise;
}

let tokenClient: any = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Resolves a valid Drive access token, prompting for Google consent via a
 * popup the first time (or after the ~1hr token expires). Cached in memory
 * only — never persisted, never touches Firestore.
 */
export function getAccessToken(): Promise<string> {
  if (!CLIENT_ID) {
    return Promise.reject(new Error("Google Drive isn't configured yet (missing VITE_GOOGLE_CLIENT_ID)."));
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return Promise.resolve(cachedToken.value);
  }
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!tokenClient) {
          tokenClient = window.google!.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: () => {}, // overridden per-request below
          });
        }
        tokenClient.callback = (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || "Google Drive authorization was cancelled or failed."));
            return;
          }
          cachedToken = { value: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
          resolve(resp.access_token);
        };
        tokenClient.requestAccessToken({ prompt: cachedToken ? "" : "consent" });
      })
  );
}

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Drive request failed (${res.status}). ${body}`.trim());
  }
  return res.status === 204 ? null : res.json();
}

/** Finds a folder by exact name under a given parent (or Drive root if no
 *  parent given), among files this app's `drive.file` scope can see. */
async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and ${parentClause} and trashed=false`
  );
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  return res.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const res = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  return res.id;
}

async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const existing = await findFolder(token, name, parentId);
  return existing ?? createFolder(token, name, parentId);
}

/**
 * Full "Connect Google Drive" flow: prompts for consent, finds-or-creates
 * the FMS Photos folder tree (safe to re-run — reuses existing folders by
 * name instead of duplicating them), and saves the resulting IDs to
 * Firestore so every other page can just read them. Call this from a
 * super_admin-only UI (Firestore rules also enforce this on write).
 */
export async function connectGoogleDrive(connectedByName: string): Promise<DriveConfig> {
  const token = await getAccessToken();

  const rootFolderId = await findOrCreateFolder(token, ROOT_FOLDER_NAME);
  const [adminFolderId, vehicleFolderId, driverFolderId] = await Promise.all([
    findOrCreateFolder(token, SUBFOLDER_NAMES.admin, rootFolderId),
    findOrCreateFolder(token, SUBFOLDER_NAMES.vehicle, rootFolderId),
    findOrCreateFolder(token, SUBFOLDER_NAMES.driver, rootFolderId),
  ]);

  const config: DriveConfig = {
    rootFolderId,
    adminFolderId,
    vehicleFolderId,
    driverFolderId,
    connectedByName,
    connectedAt: serverTimestamp(),
  };
  await setDoc(doc(db, ...DRIVE_CONFIG_DOC_PATH), config);
  return config;
}

export interface DriveUploadResult {
  fileId: string;
  url: string; // directly usable as an <img src>
}

/**
 * Uploads a Blob into the given Drive folder, makes it viewable by "anyone
 * with the link" (required so the app can display it without a backend),
 * and returns a stable thumbnail URL plus the Drive file ID (kept so the
 * app can delete it later if the photo is replaced/removed).
 */
export async function uploadPhotoToDrive(blob: Blob, filename: string, folderId: string): Promise<DriveUploadResult> {
  const token = await getAccessToken();

  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);

  const { id: fileId } = await driveFetch(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", body: form }
  );

  try {
    await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  } catch (err) {
    // The file uploaded but isn't publicly viewable yet — still return it
    // rather than failing outright, since this can be fixed manually in Drive.
    console.error("Uploaded to Drive but couldn't set public link sharing:", err);
  }

  return { fileId, url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` };
}

/** Best-effort delete — called when a photo is replaced or removed. Never
 *  throws; a leftover file in Drive is harmless and not worth blocking the
 *  UI over (5GB of free Drive storage covers thousands of these). */
export async function deletePhotoFromDrive(fileId: string): Promise<void> {
  try {
    const token = await getAccessToken();
    await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE" });
  } catch (err) {
    console.error("Couldn't delete old Drive file (non-fatal):", err);
  }
}
