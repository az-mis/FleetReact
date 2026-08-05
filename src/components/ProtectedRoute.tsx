import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types";

interface Props {
  children: ReactNode;
  /** If provided, only these roles may view this route. Omit to allow any authenticated user. */
  allow?: UserRole[];
}

export default function ProtectedRoute({ children, allow }: Props) {
  const { currentUser, role } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allow && (!role || !allow.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
