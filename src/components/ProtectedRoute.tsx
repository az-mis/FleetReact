import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { UserRole } from "../types";
import ModuleDisabledNotice from "./ModuleDisabledNotice";

interface Props {
  children: ReactNode;
  /** If provided, only these roles may view this route. Omit to allow any authenticated user. */
  allow?: UserRole[];
  /**
   * If provided, this route is also gated by the CMS feature flag with this
   * key under `flags.adminModules`. Only applies to the "admin" role — a
   * super_admin can always reach every page (including the CMS screen used
   * to re-enable a module), and drivers never have module routes gated this
   * way today. When disabled, the page itself renders a notice instead of
   * redirecting, so the sidebar link and URL stay intact and the admin
   * isn't surprised by a link vanishing.
   */
  adminModule?: keyof import("../types").AdminModuleFlags;
  /** Human-readable name of the module, used in the disabled notice. */
  adminModuleLabel?: string;
}

export default function ProtectedRoute({ children, allow, adminModule, adminModuleLabel }: Props) {
  const { currentUser, role } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allow && (!role || !allow.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (adminModule && role === "admin" && !flagsLoading && !flags.adminModules[adminModule]) {
    return <ModuleDisabledNotice moduleLabel={adminModuleLabel || "This section"} />;
  }

  return <>{children}</>;
}
