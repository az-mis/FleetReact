import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DriverSelectOption {
  value: string;
  label: string;
}

export default function DriverSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = "— Unassigned —",
}: {
  value: string;
  options: DriverSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "9px 11px",
          borderRadius: "9px",
          border: `1.5px solid ${open ? "var(--primary)" : "var(--border)"}`,
          fontSize: "13px",
          width: "100%",
          background: disabled ? "#f7fafc" : "#fff",
          color: value ? "#2d3748" : "var(--text-muted)",
          cursor: disabled ? "default" : "pointer",
          boxShadow: open ? "0 0 0 3px rgba(26,107,60,0.12)" : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            boxShadow: "0 16px 32px -8px rgba(0,0,0,0.18)",
            padding: "6px",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          <Option
            label={placeholder}
            active={!value}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          />
          {options.map((o) => (
            <Option
              key={o.value}
              label={o.label}
              active={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "9px 10px",
        borderRadius: "7px",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--primary)" : "#2d3748",
        background: active ? "var(--accent)" : "transparent",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "#f7fafc";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {active && <Check size={14} style={{ flexShrink: 0 }} />}
    </div>
  );
}
