import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SearchSelectOption {
  value: string;
  label: string;
}

/** Same look and behavior as DriverSelect, plus a search box at the top of the dropdown —
 *  for option lists too long to scan by eye (e.g. the ~50-entry office list). */
export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "— Select —",
  searchPlaceholder = "Search...",
}: {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    // Autofocus the search box the moment the dropdown opens.
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="portal-custom-select-trigger"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "0 12px",
          height: "40px",
          borderRadius: "10px",
          border: `1px solid ${open ? "rgba(72, 187, 120, 0.7)" : "rgba(255, 255, 255, 0.2)"}`,
          fontSize: "12.5px",
          width: "100%",
          background: "rgba(0, 0, 0, 0.24)",
          color: value ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
          cursor: "pointer",
          boxShadow: open ? "0 0 0 3px rgba(72,187,120,0.22), inset 0 1px 3px rgba(0,0,0,0.3)" : "inset 0 1px 3px rgba(0,0,0,0.3)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "all 0.15s ease",
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
            color: "rgba(255, 255, 255, 0.65)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          className="fade-in searchable-select-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            right: 0,
            zIndex: 60,
            background: "rgba(10, 36, 20, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "10px",
            border: "1px solid rgba(72, 187, 120, 0.35)",
            boxShadow: "0 18px 40px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <style>{`
            .searchable-select-panel .ss-list::-webkit-scrollbar { width: 5px; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-track { background: transparent; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
          `}</style>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(0, 0, 0, 0.25)",
            }}
          >
            <Search size={13} style={{ flexShrink: 0, color: "rgba(255, 255, 255, 0.6)" }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "12px",
                background: "transparent",
                color: "#ffffff",
              }}
            />
          </div>

          <div role="listbox" className="ss-list" style={{ padding: "4px", maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 10px", fontSize: "11.5px", color: "rgba(255, 255, 255, 0.5)", textAlign: "center" }}>
                No matches found.
              </div>
            ) : (
              filtered.map((o) => (
                <Option
                  key={o.value}
                  label={o.label}
                  active={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
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
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "7px 9px",
        borderRadius: "6px",
        fontSize: "12px",
        lineHeight: 1.35,
        fontWeight: active ? 700 : 500,
        color: active ? "#72ebb0" : "rgba(255, 255, 255, 0.88)",
        background: active ? "rgba(72, 187, 120, 0.22)" : "transparent",
        cursor: "pointer",
        transition: "background 0.1s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span>{label}</span>
      {active && <Check size={13} style={{ flexShrink: 0, color: "#72ebb0" }} />}
    </div>
  );
}
