import crypto from "node:crypto";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
let driveToken = null;

function adminAuth() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

async function googleAccessToken() {
  if (driveToken && driveToken.expiresAt > Date.now() + 60_000) return driveToken.value;
  const account = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${base64({ alg: "RS256", typ: "JWT" })}.${base64({
    iss: account.client_email,
    scope: DRIVE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Google Drive authorization failed.");
  const data = await response.json();
  driveToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return driveToken.value;
}

async function driveRequest(token, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.text()) || `Google Drive request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

export default async (request) => {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401 });
    await adminAuth().verifyIdToken(authorization.slice(7));
    const token = await googleAccessToken();

    if (request.method === "DELETE") {
      const { fileId } = await request.json();
      if (!fileId) return new Response(JSON.stringify({ error: "Missing file ID." }), { status: 400 });
      await driveRequest(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      return new Response(null, { status: 204 });
    }

    if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405 });
    const form = await request.formData();
    const file = form.get("file");
    const folderId = String(form.get("folderId") || "");
    const filename = String(form.get("filename") || "photo.jpg");
    if (!(file instanceof File) || !folderId) return new Response(JSON.stringify({ error: "Photo and folder are required." }), { status: 400 });

    const boundary = `----FMS${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name: filename, parents: [folderId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`),
      Buffer.from(await file.arrayBuffer()),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const uploaded = await driveRequest(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    try {
      await driveRequest(token, `https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch (error) {
      console.error("Drive file uploaded but public permission failed", error);
    }
    return new Response(JSON.stringify({ fileId: uploaded.id, url: `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w400` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Drive function error", error);
    return new Response(JSON.stringify({ error: error.message || "Drive upload failed." }), { status: 500 });
  }
};

