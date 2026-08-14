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
          background: "#fff",
          color: value ? "#2d3748" : "var(--text-muted)",
          cursor: "pointer",
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

      {open && (
        <div
          className="fade-in searchable-select-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.16)",
            overflow: "hidden",
          }}
        >
          <style>{`
            .searchable-select-panel .ss-list::-webkit-scrollbar { width: 6px; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-track { background: transparent; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-thumb { background: #d6dde3; border-radius: 3px; }
            .searchable-select-panel .ss-list::-webkit-scrollbar-thumb:hover { background: #b8c2cc; }
          `}</style>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "#fafbfc",
            }}
          >
            <Search size={14} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "13px",
                background: "transparent",
                color: "#2d3748",
              }}
            />
          </div>

          <div role="listbox" className="ss-list" style={{ padding: "6px", maxHeight: "260px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "16px 10px", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center" }}>
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
      // Blocks the browser's implicit "clicking inside a <label> forwards a
      // click to its control" behavior — without this, selecting an option
      // from inside a <label>-wrapped field can re-toggle the dropdown open
      // right after this closes it.
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 11px",
        borderRadius: "8px",
        fontSize: "13px",
        lineHeight: 1.35,
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
      <span>{label}</span>
      {active && <Check size={14} style={{ flexShrink: 0 }} />}
    </div>
  );
}
