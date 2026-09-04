// Client-side Google Drive upload, no backend involved. A super_admin
// "connects" Drive once (Content Settings > Google Drive) — a normal Google
// consent popup, same pattern as "Sign in with Google" — using Google
// Identity Services' token client, scoped to `drive.file` (this app can only
// see/manage files/folders IT creates, never the rest of the admin's Drive)
// plus a read-only `userinfo.email` scope (just to record which account
// connected, for login_hint — see getAccessToken).
// That first connect auto-creates a "FMS Photos" folder with Admins/
// Vehicles/Drivers subfolders and saves their IDs to Firestore
// (settings/driveConfig — see types.ts DriveConfig), so every other upload,
// by anyone, just reads those IDs instead of touching Drive's folder APIs.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DRIVE_CONFIG_DOC_PATH, DriveConfig } from "../types";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

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

/**
 * Fetches Google's Identity Services script ahead of time, so it's already
 * sitting in memory by the time someone actually clicks "Upload"/"Replace".
 * This matters because `requestAccessToken()` opens its consent window via
 * a real `window.open()` call, which browsers only allow inside a fresh,
 * unbroken user gesture — and `await`ing the script's network fetch inside
 * the click handler itself burns through that gesture window before the
 * popup call ever runs, so the browser silently blocks it (surfacing as
 * Google's own "Failed to open popup window... Maybe blocked by the
 * browser" warning, then our own 20s timeout). Call this once, early,
 * completely outside of any click — see DriveConfigContext, which calls it
 * as soon as someone's signed in. Never throws; a failure here just means
 * the first real click will (re)try the fetch itself, same as before.
 */
export function preloadGoogleIdentityServices(): void {
  if (!CLIENT_ID) return;
  loadGis().catch(() => {
    // Ignore — loadGis() will simply be retried the next time it's called.
  });
}

let tokenClient: any = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlightTokenRequest: Promise<string> | null = null;

// How long we let a single Drive auth/upload step run before giving up and
// showing the person a "try again later" message instead of leaving them
// staring at an endless "Uploading to Drive…" spinner. This matters most for
// non-owner accounts (e.g. an Admin, as opposed to the Super Admin who
// originally connected Drive): their silent token refresh is expected to
// fail, and the interactive popup that follows can get silently blocked by
// the browser if it fires outside a fresh user gesture — in that case
// Google's client never calls back at all, so without a timeout the promise
// would simply hang forever.
const AUTH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

const TIMEOUT_MESSAGE =
  "This is taking longer than expected. Please try again later.";

/**
 * Resolves a valid Drive access token, prompting for Google consent via a
 * popup the first time (or after the ~1hr token expires). Cached in memory
 * only — never persisted, never touches Firestore.
 *
 * On a fresh page load there's no in-memory cachedToken yet, but the user
 * may well have already granted this app Drive access in an earlier
 * session — so by default we first try a silent refresh (prompt: "none"),
 * which just re-mints a token with no UI if consent is still valid, and
 * only fall back to the full "choose an account" consent screen if that
 * silent attempt actually fails (e.g. truly first-time authorization, or
 * consent was revoked).
 *
 * The silent attempt uses a hidden iframe under the hood, which some
 * browsers' third-party-cookie restrictions can cause to hang without ever
 * calling back — so it's given a short timeout and treated as a failure
 * (falling through to the interactive screen) if nothing comes back in
 * time, rather than leaving the caller stuck forever.
 *
 * Pass `forceInteractive: true` for an explicit user-initiated "Connect" /
 * "Reconnect" action — there's no point trying silently when the user just
 * clicked a button specifically to go through the picker themselves, and
 * skipping it avoids any chance of that hang.
 *
 * `loginHint` (typically DriveConfig.connectedByEmail) pins both attempts
 * to the specific Google account that connected Drive, so a browser signed
 * into multiple Google accounts doesn't end up using — or being asked to
 * pick between — the wrong one.
 */
export function getAccessToken(loginHint?: string, forceInteractive = false): Promise<string> {
  if (!CLIENT_ID) {
    return Promise.reject(new Error("Google Drive isn't configured yet (missing VITE_GOOGLE_CLIENT_ID)."));
  }
  if (!forceInteractive && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return Promise.resolve(cachedToken.value);
  }
  // Google's token client only has one callback slot at a time — if a
  // second request comes in (e.g. the "preauthorize on photo pick" call is
  // still waiting on an interactive popup when Save triggers the real
  // upload's own getAccessToken call) it would silently overwrite the first
  // request's callback, leaving that first caller's promise unresolved
  // forever. So instead of starting a fresh request, any call that arrives
  // while one is already in flight just piggybacks on that same promise.
  if (!forceInteractive && inFlightTokenRequest) {
    return inFlightTokenRequest;
  }
  const request = withTimeout(getAccessTokenInner(loginHint, forceInteractive), AUTH_TIMEOUT_MS, TIMEOUT_MESSAGE);
  if (!forceInteractive) {
    inFlightTokenRequest = request;
    request.finally(() => {
      if (inFlightTokenRequest === request) inFlightTokenRequest = null;
    });
  }
  return request;
}

function getAccessTokenInner(loginHint?: string, forceInteractive = false): Promise<string> {
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

        let triedInteractive = forceInteractive;
        let silentTimeout: ReturnType<typeof setTimeout> | null = null;

        function goInteractive() {
          if (triedInteractive) return; // already showing (or shown) the picker — don't fire it twice
          triedInteractive = true;
          if (silentTimeout) clearTimeout(silentTimeout);
          tokenClient.requestAccessToken({ prompt: "consent", login_hint: loginHint });
        }

        tokenClient.callback = (resp: any) => {
          if (silentTimeout) clearTimeout(silentTimeout);
          if (resp.error) {
            if (!triedInteractive) {
              // Silent refresh failed (no active session / consent not yet
              // granted / revoked) — fall back to the interactive consent
              // screen exactly once.
              goInteractive();
              return;
            }
            reject(new Error(resp.error_description || "Google Drive authorization was cancelled or failed."));
            return;
          }
          cachedToken = { value: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
          resolve(resp.access_token);
        };

        if (forceInteractive) {
          tokenClient.requestAccessToken({ prompt: "consent", login_hint: loginHint });
        } else {
          // Guard against the silent iframe hanging with no callback at all
          // (seen under some browsers' third-party-cookie restrictions).
          silentTimeout = setTimeout(goInteractive, 4000);
          tokenClient.requestAccessToken({ prompt: "none", login_hint: loginHint });
        }
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
  // Explicit user-initiated action (the Connect / Reconnect button) — go
  // straight to the interactive account picker rather than trying a silent
  // refresh first, since the user is already deliberately choosing an
  // account and there's nothing to gain from attempting silent auth here.
  const token = await getAccessToken(undefined, true);

  const rootFolderId = await findOrCreateFolder(token, ROOT_FOLDER_NAME);
  const [adminFolderId, vehicleFolderId, driverFolderId] = await Promise.all([
    findOrCreateFolder(token, SUBFOLDER_NAMES.admin, rootFolderId),
    findOrCreateFolder(token, SUBFOLDER_NAMES.vehicle, rootFolderId),
    findOrCreateFolder(token, SUBFOLDER_NAMES.driver, rootFolderId),
  ]);

  // Record which Google account this is, so future token requests (from any
  // device) can be pinned to it via login_hint instead of leaving Google to
  // guess which signed-in account to use.
  let connectedByEmail: string | undefined;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) connectedByEmail = (await res.json()).email;
  } catch (err) {
    console.error("Connected to Drive but couldn't look up the account email:", err);
  }

  const config: DriveConfig = {
    rootFolderId,
    adminFolderId,
    vehicleFolderId,
    driverFolderId,
    connectedByName,
    connectedByEmail,
    connectedAt: serverTimestamp(),
  };
  await setDoc(doc(db, ...DRIVE_CONFIG_DOC_PATH), config);
  return config;
}

/**
 * Best-effort "warm up" of Drive authorization, meant to be called the
 * instant the person picks a photo (still inside that click's user-gesture
 * window) rather than later on Save. Google's interactive consent popup is
 * only reliably allowed through by the browser when it's triggered close to
 * a real user action; requesting it here — instead of after image
 * compression and other awaits have already run — is what lets an Admin
 * (whose session usually needs the interactive popup, unlike the Super
 * Admin who connected Drive and already has a silent-refreshable session)
 * actually get prompted instead of having the popup silently blocked.
 *
 * Never throws: any failure here is simply left for the real upload call
 * (during Save) to surface properly, since by then it's a fully-informed
 * error the person can act on.
 */
export function preauthorizeDrive(loginHint?: string): void {
  if (!CLIENT_ID) return;
  getAccessToken(loginHint).catch(() => {
    // Ignore — handled again (with a real error message) at actual upload time.
  });
}

export interface DriveUploadResult {
  fileId: string;
  url: string; // directly usable as an <img src>
}

/**
 * Uploads a Blob into the given Drive folder, makes it viewable by "anyone
 * with the link" (required so the app can display it without a backend),
 * and returns a stable thumbnail URL plus the Drive file ID (kept so the
 * app can delete it later if the photo is replaced/removed). Pass
 * `loginHint` (DriveConfig.connectedByEmail) so the token request is pinned
 * to the account that connected Drive.
 */
export async function uploadPhotoToDrive(
  blob: Blob,
  filename: string,
  folderId: string,
  loginHint?: string
): Promise<DriveUploadResult> {
  const token = await getAccessToken(loginHint);

  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);

  const { id: fileId } = await withTimeout(
    driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      body: form,
    }),
    AUTH_TIMEOUT_MS,
    TIMEOUT_MESSAGE
  );

  try {
    await withTimeout(
      driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      }),
      AUTH_TIMEOUT_MS,
      TIMEOUT_MESSAGE
    );
  } catch (err) {
    // The file uploaded but isn't publicly viewable yet — still return it
    // rather than failing outright, since this can be fixed manually in Drive.
    console.error("Uploaded to Drive but couldn't set public link sharing:", err);
  }

  return { fileId, url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` };
}

/** Best-effort delete — called when a photo is replaced or removed. Never
 *  throws; a leftover file in Drive is harmless and not worth blocking the
 *  UI over (5GB of free Drive storage covers thousands of these). Pass
 *  `loginHint` (DriveConfig.connectedByEmail) so the token request is
 *  pinned to the account that connected Drive. */
export async function deletePhotoFromDrive(fileId: string, loginHint?: string): Promise<void> {
  try {
    const token = await getAccessToken(loginHint);
    await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE" });
  } catch (err) {
    console.error("Couldn't delete old Drive file (non-fatal):", err);
  }
}
