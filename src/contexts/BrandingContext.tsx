import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { AppBranding, BRANDING_DOC_PATH } from "../types";

interface BrandingContextValue {
  branding: AppBranding | null; // null until a super_admin sets a logo
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<AppBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Unlike the other settings-backed contexts, this one subscribes
    // whether or not anyone is signed in — firestore.rules makes
    // settings/appBranding specifically public-readable so the logged-out
    // Login screen can show the logo too.
    const ref = doc(db, ...BRANDING_DOC_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setBranding(snap.exists() ? (snap.data() as AppBranding) : null);
        setLoading(false);
      },
      () => {
        setBranding(null);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return <BrandingContext.Provider value={{ branding, loading }}>{children}</BrandingContext.Provider>;
}
