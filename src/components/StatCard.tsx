import React, { useState } from "react";
import { LucideIcon } from "lucide-react";

// CSS variables can't have alpha hex suffixes appended directly (e.g.
// "var(--primary)cc" is invalid CSS and fails silently). Resolve known
// tokens to their real hex values so gradients/shadows render correctly.
const COLOR_MAP: Record<string, string> = {
  "var(--primary)": "#1a6b3c",
  "var(--primary-dark)": "#134d2b",
  "var(--primary-light)": "#2d9e5f",
  "var(--secondary)": "#f6a623",
  "var(--danger)": "#e53e3e",
  "var(--warning)": "#dd9a05",
  "var(--info)": "#2b6cb0",
};

function resolveColor(color: string): string {
  return COLOR_MAP[color] ?? color;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  color = "var(--primary)",
  sublabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  sublabel?: string;
}) {
  const [hover, setHover] = useState(false);
  const resolved = resolveColor(color);

  return (
    <div
      className="fade-in"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "#ffffff",
        borderRadius: "12px",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        border: "1px solid rgba(226,232,240,0.8)",
        boxShadow: hover
          ? "0 8px 16px -8px rgba(26,107,60,0.18), 0 2px 4px rgba(0,0,0,0.04)"
          : "0 1px 4px rgba(15,23,42,0.04)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${resolved}, ${resolved}55)`,
        }}
      />
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "8px",
          background: `linear-gradient(135deg, ${resolved}, ${resolved}cc)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
          boxShadow: `0 4px 10px -3px ${resolved}66`,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            marginBottom: "1px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
          <span style={{ fontSize: "19px", fontWeight: 800, color: "#1a202c", lineHeight: 1 }}>
            {value}
          </span>
          {sublabel && (
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 500 }}>
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
