import React, { useState } from "react";
import { Search, X } from "lucide-react";

export default function HeaderSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="header-search" style={{ position: "relative" }}>
      <Search
        size={15}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: focused ? "var(--primary)" : "var(--text-muted)",
          transition: "color 0.15s ease",
          pointerEvents: "none",
        }}
      />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: value ? "9px 32px 9px 34px" : "9px 12px 9px 34px",
          borderRadius: "10px",
          border: focused ? "1.5px solid #fff" : "1.5px solid transparent",
          fontSize: "13px",
          width: "100%",
          background: "rgba(255,255,255,0.95)",
          textOverflow: "ellipsis",
          boxShadow: focused
            ? "0 0 0 3px rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.12)"
            : "0 1px 3px rgba(0,0,0,0.08)",
          transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--border)",
            border: "none",
            borderRadius: "50%",
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4a5568",
            padding: 0,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
