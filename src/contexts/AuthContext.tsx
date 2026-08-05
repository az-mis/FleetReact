import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AppUser, UserRole } from "../types";

interface AuthContextValue {
  currentUser: User | null; // Firebase Auth identity (email, uid)
  profile: AppUser | null; // Firestore profile (name, role, ...)
  role: UserRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean; // true for both admin AND super_admin
  isDriver: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  // Track Firebase Auth identity.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Track the matching Firestore users/{uid} doc, which is the source of
  // truth for role (super_admin / admin / driver). Live-updates so a role
  // change takes effect immediately without requiring re-login.
  useEffect(() => {
    if (!currentUser) return;
    setProfileLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) });
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return unsubscribe;
  }, [currentUser]);

  const role = profile?.role ?? null;

  const value: AuthContextValue = {
    currentUser,
    profile,
    role,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "super_admin",
    isDriver: role === "driver",
    login,
    logout,
  };

  const loading = authLoading || (!!currentUser && profileLoading);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
