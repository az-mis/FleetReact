import React from "react";
import { PowerOff } from "lucide-react";

// Shown inside the page area (not a redirect) when a super_admin has turned
// a module off for the "admin" role via Content Settings. Keeps the sidebar
// link and the URL intact — the admin lands here on purpose, not by
// surprise, and knows exactly who to ask to turn it back on.
export default function ModuleDisabledNotice({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div
      className="fade-in"
      style={{
        background: "#fff",
        border: "1px dashed var(--border)",
        borderRadius: "16px",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "14px",
          background: "rgba(160,174,192,0.15)",
          color: "#718096",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "4px",
        }}
      >
        <PowerOff size={24} />
      </div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a202c" }}>
        {moduleLabel} is currently turned off
      </h2>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: 380 }}>
        A super admin has temporarily disabled this section for admin accounts. Reach out to a
        super admin if you need it turned back on.
      </p>
    </div>
  );
}
