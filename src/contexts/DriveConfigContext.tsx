import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { DRIVE_CONFIG_DOC_PATH, DriveConfig } from "../types";

interface DriveConfigContextValue {
  config: DriveConfig | null; // null until Google Drive has been connected
  loading: boolean;
}

const DriveConfigContext = createContext<DriveConfigContextValue | undefined>(undefined);

export function useDriveConfig(): DriveConfigContextValue {
  const ctx = useContext(DriveConfigContext);
  if (!ctx) throw new Error("useDriveConfig must be used within DriveConfigProvider");
  return ctx;
}

export function DriveConfigProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [config, setConfig] = useState<DriveConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reading requires an authenticated Firestore session (see
    // firestore.rules: settings/{id} is read-only to signed-in users).
    if (!currentUser) {
      setConfig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, ...DRIVE_CONFIG_DOC_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setConfig(snap.exists() ? (snap.data() as DriveConfig) : null);
        setLoading(false);
      },
      () => {
        setConfig(null);
        setLoading(false);
      }
    );
    return unsub;
  }, [currentUser]);

  return <DriveConfigContext.Provider value={{ config, loading }}>{children}</DriveConfigContext.Provider>;
}
