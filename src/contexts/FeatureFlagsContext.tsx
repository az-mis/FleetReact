import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS_DOC_PATH,
  FeatureFlags,
} from "../types";

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  loading: boolean;
  // Deep-merges `patch` into the stored flags (so callers can send just the
  // slice they changed, e.g. { adminModules: { vehicles: false } }).
  updateFlags: (patch: DeepPartial<FeatureFlags>) => Promise<void>;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
}

function mergeFlags(remote: any): FeatureFlags {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...remote,
    adminModules: { ...DEFAULT_FEATURE_FLAGS.adminModules, ...(remote?.adminModules || {}) },
    driverModules: { ...DEFAULT_FEATURE_FLAGS.driverModules, ...(remote?.driverModules || {}) },
    adminAnnouncement: { ...DEFAULT_FEATURE_FLAGS.adminAnnouncement, ...(remote?.adminAnnouncement || {}) },
    driverAnnouncement: { ...DEFAULT_FEATURE_FLAGS.driverAnnouncement, ...(remote?.driverAnnouncement || {}) },
  };
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { currentUser, profile } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reading requires an authenticated Firestore session (see
    // firestore.rules: settings/{id} is read-only to signed-in users).
    if (!currentUser) {
      setFlags(DEFAULT_FEATURE_FLAGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, ...FEATURE_FLAGS_DOC_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setFlags(snap.exists() ? mergeFlags(snap.data()) : DEFAULT_FEATURE_FLAGS);
        setLoading(false);
      },
      () => {
        // If the doc doesn't exist yet (or rules deny it for some reason),
        // fall back to "everything on" rather than hiding features.
        setFlags(DEFAULT_FEATURE_FLAGS);
        setLoading(false);
      }
    );
    return unsub;
  }, [currentUser]);

  async function updateFlags(patch: DeepPartial<FeatureFlags>) {
    const ref = doc(db, ...FEATURE_FLAGS_DOC_PATH);
    const merged = mergeFlags({
      ...flags,
      ...patch,
      adminModules: { ...flags.adminModules, ...(patch.adminModules || {}) },
      driverModules: { ...flags.driverModules, ...(patch.driverModules || {}) },
      adminAnnouncement: { ...flags.adminAnnouncement, ...(patch.adminAnnouncement || {}) },
      driverAnnouncement: { ...flags.driverAnnouncement, ...(patch.driverAnnouncement || {}) },
    });
    await setDoc(
      ref,
      {
        ...merged,
        updatedAt: serverTimestamp(),
        updatedByName: profile?.name || null,
      },
      { merge: true }
    );
  }

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, updateFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
