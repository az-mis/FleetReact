# Fleet Management Dashboard (React + TypeScript + Firebase)

This is a React/TypeScript/Firebase rebuild of the original Laravel fleet-management
app (`latest.zip`), following the file/style pattern of `pattern.zip` (`mis-dashboard`).

## What changed vs. the Laravel app

- **Stack**: Laravel + Blade → React 18 + TypeScript + Vite, with Firebase Auth
  (instead of Laravel session auth) and Firestore (instead of MySQL/SQLite).
- **Roles & authorization** (new — the pattern project had none): `super_admin`,
  `admin`, `driver`, stored on `users/{uid}.role` in Firestore and enforced both
  client-side (`AuthContext` + `ProtectedRoute`) and server-side (`firestore.rules`).
  - **Super Admin**: full access — manages Admins, Drivers, and Vehicles, and is the
    only role allowed to change a vehicle's plate number after it's registered.
  - **Admin**: manages Drivers and Vehicles, cannot manage other Admins.
  - **Driver**: dashboard only, no management access.
- **No image upload**: the Laravel app stored vehicle photos, avatars, and driver's
  license photos on disk (`Storage::disk('public')`). Per your request, none of that
  was ported — this app is Firestore-only (free tier), so there is no `photo`,
  `avatar`, or `license_front/back` upload anywhere.
- **Env keys**: all Firebase credentials are read from `.env.local` — see below.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your real Firebase project keys
npm run dev
```

### 1. Create a Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. In **Build → Authentication**, enable the **Email/Password** sign-in provider.
3. In **Build → Firestore Database**, create a database (start in production mode).
4. In **Project settings → General → Your apps**, add a **Web app** and copy the
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

`.env.local` is already in `.gitignore` — never commit real keys. Use `.env.example`
as the template for teammates / CI, and set the same variables as environment
variables in your host's dashboard (Netlify, Vercel, etc.) for production.

### 2. Deploy Firestore security rules

`firestore.rules` enforces the same role rules as the UI, so no one can bypass
`admin`/`super_admin` checks by calling Firestore directly:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point it at this project, keep firestore.rules as-is
firebase deploy --only firestore:rules
```

### 3. Create your first Super Admin

The app has no public sign-up page (only admins create accounts), so the very
first Super Admin has to be created manually once:

1. In the Firebase Console → Authentication → **Add user** (email + password).
2. In Firestore → **users** collection → add a document with that user's **UID**
   as the document ID, containing:
   ```json
   { "name": "Your Name", "email": "you@example.com", "role": "super_admin" }
   ```
3. Log in with that account — you'll now see the Admins, Drivers, and Vehicles
   sections and can create further accounts from the UI itself.

## Notes on account creation from the UI

Firebase's client SDK signs you in as whichever account you just created with
`createUserWithEmailAndPassword`. To let a Super Admin add a new Admin/Driver
without being kicked out of their own session, `src/lib/secondaryAuth.ts` spins
up a temporary second Firebase app instance for the create-account call and
tears it down immediately after — the admin's real session is untouched.

Changing an existing user's **email** or **password**, and fully deleting their
Auth account (not just their Firestore profile), requires the Firebase **Admin
SDK**, which only runs in a trusted backend (e.g. a Cloud Function) — not in the
browser. Those actions are left as TODOs / Cloud Function hooks; deleting a user
from the UI here removes their Firestore profile (revoking app access) but the
Auth account itself would need to be cleaned up from a backend or the console.

## Project structure

```
src/
  firebase.ts             Firebase app/auth/db init, reads keys from .env.local
  types.ts                AppUser, UserRole, Vehicle types
  lib/secondaryAuth.ts     Create-user-without-signing-out helper
  contexts/AuthContext.tsx Auth state + live Firestore role
  components/
    ProtectedRoute.tsx     Route guard (auth + role allow-list)
    Layout.tsx              Sidebar/topbar shell, role-aware nav
    Modal.tsx, StatCard.tsx
  pages/
    Login.tsx
    Dashboard.tsx
    Vehicles.tsx           Admin + Super Admin
    Drivers.tsx            Admin + Super Admin
    Admins.tsx             Super Admin only
    Unauthorized.tsx
firestore.rules           Server-side role enforcement
```
