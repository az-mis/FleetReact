import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function Unauthorized() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "16px",
        textAlign: "center",
      }}
    >
      <ShieldAlert size={40} color="var(--danger)" />
      <h1 style={{ fontSize: "18px", fontWeight: 700 }}>You don't have access to this page</h1>
      <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: 360 }}>
        Your account role doesn't have permission to view this section. Contact a super admin if you believe this is
        a mistake.
      </p>
      <Link to="/" style={{ color: "var(--primary)", fontWeight: 600, fontSize: "14px" }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
