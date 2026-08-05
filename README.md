# Fleet Management Dashboard (React + TypeScript + Firebase)

A React 18 + TypeScript + Vite rebuild of a Laravel fleet-management app, using
Firebase Authentication for login and Cloud Firestore (free tier) for data —
no image/file uploads anywhere.

## Stack

- React 18 + TypeScript + Vite
- React Router v6
- Firebase Authentication (Email/Password)
- Cloud Firestore
- lucide-react icons

## Roles & Authorization

Three roles, stored on `users/{uid}.role` in Firestore and enforced both in
the UI and server-side via `firestore.rules`:

| Role | Access |
|---|---|
| `super_admin` | Everything — Admins, Drivers, Vehicles. Only role that can change a vehicle's plate number after it's registered. |
| `admin` | Drivers, Vehicles. Cannot manage other Admins. |
| `driver` | Dashboard only. |

---

## 1. Setup

```bash
npm install
cp .env.example .env.local   # then fill in your real Firebase project keys
npm run dev
```

### Create a Firebase project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication** → enable the **Email/Password** sign-in provider.
3. **Build → Firestore Database** → create a database.
4. **Project settings → General → Your apps** → add a **Web app** → copy the
   config values into `.env.local`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

`.env.local` is gitignored — never commit real keys. Use `.env.example` as the
template for teammates/CI, and set the same variables in your host's
dashboard (Netlify, Vercel, etc.) for production.

### Deploy Firestore security rules

`firestore.rules` mirrors the UI's role checks so no one can bypass
`admin`/`super_admin` restrictions by calling Firestore directly.

**Option A — Firebase Console (fastest, no CLI):**
Firestore Database → **Rules** tab → paste the contents of `firestore.rules` →
**Publish**.

**Option B — CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point it at this project, keep firestore.rules as-is
firebase deploy --only firestore:rules
```

### Create the required Firestore composite indexes

The Drivers and Admins pages filter by `role` **and** sort by `createdAt`,
which Firestore requires a composite index for. Without it, those pages will
load with **zero rows and no visible error** in the UI (the failure only
shows up in the browser console).

Easiest way: just use the app once, open DevTools → **Console** on `/drivers`,
and click the link in the error that looks like:

```
FirebaseError: [code=failed-precondition]: The query requires an index.
You can create it here: https://console.firebase.google.com/...
```

Click **Create Index**, wait for status **Building → Enabled** (~1–2 min).
Repeat on `/admins` — it needs its own separate index since its query uses
`role in [...]` instead of `role ==`.

Or create them manually in **Firestore → Indexes → Add Index**:

| Page | Collection | Fields |
|---|---|---|
| Drivers | `users` | `role` Ascending, `createdAt` Descending |
| Admins | `users` | `role` Ascending, `createdAt` Descending |

### Bootstrap your first Super Admin

The app has no public sign-up page, so the very first account has to be
created manually, once:

1. **Authentication → Users → Add user** — enter an email + password.
2. Copy the new user's **UID**.
3. **Firestore → users collection → Add document** — Document ID = that UID:
   ```json
   { "name": "Your Name", "email": "you@example.com", "role": "super_admin" }
   ```
4. Log in at `/login` with that email/password.

From there, create Admins and Drivers from inside the app (**Admins → Add
Admin**, **Drivers → Add Driver**) — don't create them directly in the
Firebase Console. Console-created users have an Auth login but no matching
Firestore profile, so they won't show up anywhere in the app.

---

## 2. How account creation works

Firebase's client SDK signs you in as whichever account you just created with
`createUserWithEmailAndPassword`. To let a Super Admin/Admin add a new
account without being kicked out of their own session, `src/lib/secondaryAuth.ts`
spins up a temporary second Firebase app instance for the create-account call
and tears it down right after — the admin's real session is untouched.

**Known limitation:** changing an existing user's email/password, or fully
deleting their Auth account (not just their Firestore profile), requires the
Firebase **Admin SDK**, which only runs in a trusted backend (e.g. a Cloud
Function) — not in the browser. Deleting a user from the UI here removes
their Firestore profile (which revokes app access) but the Auth account
itself needs cleanup from the Console or a backend.

---

## 3. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Sidebar shows no Vehicles/Drivers/Admins, "Signed in as —" | Firestore rules not published, or blocking the read of your own `users/{uid}` doc | Publish `firestore.rules`; confirm your doc's `role` field is exactly `admin` or `super_admin` (lowercase) |
| New driver/admin appears in Authentication but not in the app's list | Missing Firestore composite index — `onSnapshot` fails silently in the UI | See "Create the required Firestore composite indexes" above |
| Account created via Firebase Console doesn't show in the app | Console-created users only exist in Authentication, no Firestore `users/{uid}` doc | Always create accounts via **Add Driver**/**Add Admin** in the app, not the Console |
| "Missing or insufficient permissions" in console | Firestore rules reject the read/write | Check rules are Published and your role field is correct |
| Chrome "Change your password" popup on account creation | Chrome's built-in breach-check on the password you typed — unrelated to the app | Safe to dismiss; use a stronger temp password |

---

## 4. Project structure

```
src/
  firebase.ts               Firebase app/auth/db init, reads keys from .env.local
  types.ts                  AppUser, UserRole, Vehicle types
  lib/secondaryAuth.ts       Create-user-without-signing-out helper
  contexts/AuthContext.tsx   Auth state + live Firestore role
  components/
    ProtectedRoute.tsx       Route guard (auth + role allow-list)
    Layout.tsx                Sidebar/topbar shell, role-aware nav
    Modal.tsx, StatCard.tsx
  pages/
    Login.tsx
    Dashboard.tsx
    Vehicles.tsx             Admin + Super Admin
    Drivers.tsx              Admin + Super Admin
    Admins.tsx                Super Admin only
    Unauthorized.tsx
firestore.rules             Server-side role enforcement
```

## 5. What's intentionally different from the original Laravel app

- No image/file uploads anywhere (no vehicle photo, avatar, or driver's
  license images) — Firestore-only, free tier.
- Role-based authorization (`super_admin` / `admin` / `driver`) added; the
  original reference UI this was patterned after had no roles at all.
- No public self-registration — all accounts are created by an Admin or
  Super Admin from within the app.
