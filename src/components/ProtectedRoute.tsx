import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { UserRole } from "../types";

interface Props {
  children: ReactNode;
  /** If provided, only these roles may view this route. Omit to allow any authenticated user. */
  allow?: UserRole[];
  /**
   * If provided, this route is also gated by the CMS feature flag with this
   * key under `flags.adminModules`. Only applies to the "admin" role — a
   * super_admin can always reach every page (including the CMS screen used
   * to re-enable a module), and drivers never have module routes gated this
   * way today.
   */
  adminModule?: keyof import("../types").AdminModuleFlags;
}

export default function ProtectedRoute({ children, allow, adminModule }: Props) {
  const { currentUser, role } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allow && (!role || !allow.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (adminModule && role === "admin" && !flagsLoading && !flags.adminModules[adminModule]) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
