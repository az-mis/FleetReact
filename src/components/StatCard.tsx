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
        borderRadius: "14px",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        border: "1px solid rgba(226,232,240,0.8)",
        boxShadow: hover
          ? "0 10px 20px -10px rgba(26,107,60,0.18), 0 2px 6px rgba(0,0,0,0.04)"
          : "0 2px 8px rgba(15,23,42,0.05)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.25s ease",
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
          width: 38,
          height: 38,
          borderRadius: "10px",
          background: `linear-gradient(135deg, ${resolved}, ${resolved}cc)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
          boxShadow: `0 6px 14px -4px ${resolved}66`,
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "11.5px",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "2px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "#1a202c", lineHeight: 1 }}>
            {value}
          </span>
          {sublabel && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
