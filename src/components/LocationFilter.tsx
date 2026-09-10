import React, { useEffect, useRef, useState } from "react";
import { MapPin, Check, ChevronDown } from "lucide-react";

export const FILTER_LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
];

interface LocationFilterProps {
  value: string; // "" means All Locations
  onChange: (loc: string) => void;
  locations?: string[];
  label?: string;
  style?: React.CSSProperties;
}

export default function LocationFilter({
  value,
  onChange,
  locations = FILTER_LOCATIONS,
  label = "Location",
  style,
}: LocationFilterProps) {
  const [open, setOpen] = useState(false);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate alignment and make sure menu doesn't overflow viewport on mobile
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      
      // If the button is closer to the left side of the screen or right side would overflow
      if (rect.left < 220 || rect.right > screenWidth - 20) {
        // If button is near left edge, align menu to left of button
        if (rect.left < screenWidth / 2) {
          setMenuAlign("left");
        } else {
          setMenuAlign("right");
        }
      } else {
        setMenuAlign("right");
      }
    }
  }, [open]);

  const selectedText = value || "All Locations";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          height: "34px",
          padding: "0 12px",
          borderRadius: "8px",
          border: value ? "1.5px solid var(--primary)" : "1px solid rgba(255,255,255,0.25)",
          background: value ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)",
          color: value ? "var(--primary)" : "#fff",
          fontSize: "12.5px",
          fontWeight: 700,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
        title={`Filter by ${label}`}
      >
        <MapPin size={14} style={{ opacity: value ? 1 : 0.9, color: value ? "var(--primary)" : "#fff" }} />
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
          {selectedText}
        </span>
        <ChevronDown size={13} style={{ opacity: 0.8, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(menuAlign === "left" ? { left: 0 } : { right: 0 }),
            zIndex: 9999,
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08)",
            width: "max-content",
            minWidth: "220px",
            maxWidth: "calc(100vw - 32px)",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            animation: "fadeIn 0.15s ease",
          }}
        >
          <div
            style={{
              padding: "6px 8px 4px 8px",
              fontSize: "10.5px",
              fontWeight: 800,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Filter by Location
          </div>

          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "none",
              background: !value ? "#e6f7ee" : "transparent",
              color: !value ? "var(--primary)" : "#2d3748",
              fontSize: "12.5px",
              fontWeight: !value ? 700 : 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.1s ease",
            }}
          >
            <span>All Locations</span>
            {!value && <Check size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
          </button>

          {locations.map((loc) => {
            const active = value === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  onChange(loc);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: active ? "#e6f7ee" : "transparent",
                  color: active ? "var(--primary)" : "#2d3748",
                  fontSize: "12.5px",
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s ease",
                }}
              >
                <span style={{ marginRight: 8 }}>{loc}</span>
                {active && <Check size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
