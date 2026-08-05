import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

// Firebase's client SDK signs you in as the account you just created with
// createUserWithEmailAndPassword — which would kick the currently logged-in
// admin/super admin out of their own session when they add a new admin or
// driver. The standard workaround is to spin up a second, temporary Firebase
// App instance just for the create-account call, then tear it down. The
// admin's real session (on the default app) is never touched.
export async function createUserWithoutSignIn(email: string, password: string) {
  const secondaryApp = initializeApp((await import("../firebase")).default.options, "secondary-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    const existing = getApps().find((a) => a.name === secondaryApp.name);
    if (existing) await deleteApp(existing);
  }
}
