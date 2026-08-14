import React from "react";
import { Camera, X } from "lucide-react";

/** Small circular avatar — shows the photo if present, otherwise the person's initial on a
 *  solid primary-color background (matching the profile badge elsewhere in the app). Used in
 *  list/grid views and anywhere a compact identity chip fits. */
export function Avatar({ name, photoURL, size = 32 }: { name: string; photoURL?: string | null; size?: number }) {
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (photoURL) {
    return <img src={photoURL} alt={name} style={{ ...common, objectFit: "cover" }} />;
  }
  return (
    <div
      style={{
        ...common,
        background: "var(--primary)",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </div>
  );
}

/** Circular photo picker for Add/Edit forms — click (or the small camera badge) to choose a
 *  photo, "×" badge appears once a photo is set to clear it. Deliberately plain: no
 *  borders/cards, just the avatar itself and two tiny action badges. */
export function AvatarPicker({
  inputId,
  name,
  photoURL,
  onSelect,
  onRemove,
  error,
}: {
  inputId: string;
  name: string;
  photoURL: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
      <div style={{ position: "relative", width: 76, height: 76 }}>
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            width: 76,
            height: 76,
            borderRadius: "50%",
            cursor: "pointer",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <Avatar name={name} photoURL={photoURL} size={76} />
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />

        <label
          htmlFor={inputId}
          aria-label="Choose photo"
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "2px solid #fff",
          }}
        >
          <Camera size={12} />
        </label>

        {photoURL && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove photo"
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>
      {error ? (
        <span style={{ fontSize: "11px", color: "var(--danger)" }}>{error}</span>
      ) : (
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Photo (optional)</span>
      )}
    </div>
  );
}
