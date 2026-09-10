import React from "react";
import { LucideIcon } from "lucide-react";

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="page-header"
      style={{
        position: "relative",
        borderRadius: "14px",
        padding: "14px 18px",
        marginBottom: "16px",
        background:
          "linear-gradient(120deg, var(--primary-dark) 0%, var(--primary) 55%, var(--primary-light) 100%)",
        boxShadow: "0 8px 20px -8px rgba(19,77,43,0.4)",
        overflow: "visible",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
      }}
    >
      {/* decorative pattern */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-40px",
          right: "-20px",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
        }}
      />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
        {Icon && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </div>
        )}
        <div>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.8)", marginTop: "1px" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="page-header-actions" style={{ position: "relative", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
