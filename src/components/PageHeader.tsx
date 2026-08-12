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
        borderRadius: "20px",
        padding: "18px 24px",
        marginBottom: "20px",
        background:
          "linear-gradient(120deg, var(--primary-dark) 0%, var(--primary) 55%, var(--primary-light) 100%)",
        boxShadow: "0 14px 30px -12px rgba(19,77,43,0.45)",
        overflow: "hidden",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      {/* decorative pattern */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-50px",
          right: "-30px",
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "-60px",
          right: "60px",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        }}
      />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px" }}>
        {Icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: "rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Icon size={20} />
          </div>
        )}
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.8)", marginTop: "2px" }}>
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
