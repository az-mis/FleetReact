import React from "react";
import { Camera, X, LucideIcon } from "lucide-react";

type FallbackProps =
  | { fallback?: "initials"; name: string; icon?: undefined }
  | { fallback: "icon"; icon: LucideIcon; name?: string };

/** Small avatar — shows the photo if present, otherwise a fallback. Two fallback modes:
 *  - "initials" (default): the person's initial on a solid primary-color circle, matching
 *    the profile badge elsewhere in the app. Used for admins/drivers.
 *  - "icon": a given icon on a soft accent-color rounded square. Used for vehicles, where
 *    an initial letter (e.g. from a plate number) isn't a meaningful identity cue.
 *  Used in list/grid views and anywhere a compact identity chip fits. */
export function Avatar({
  photoURL,
  size = 32,
  ...rest
}: { photoURL?: string | null; size?: number } & FallbackProps) {
  const isIcon = rest.fallback === "icon";
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: isIcon ? size * 0.24 : "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (photoURL) {
    return <img src={photoURL} alt={rest.name || "Photo"} style={{ ...common, objectFit: "cover" }} />;
  }
  if (isIcon) {
    const Icon = rest.icon;
    return (
      <div style={{ ...common, background: "var(--accent)", color: "var(--primary)" }}>
        <Icon size={size * 0.5} />
      </div>
    );
  }
  const initial = (rest.name || "?").trim()[0]?.toUpperCase() || "?";
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

/** Photo picker for Add/Edit forms — click (or the small camera badge) to choose a photo,
 *  "×" badge appears once a photo is set to clear it. Deliberately plain: no borders/cards,
 *  just the avatar itself and two tiny action badges. Pass `fallback="icon"` + `icon` for
 *  non-person subjects (e.g. vehicles) instead of the default initials-on-circle look. */
export function AvatarPicker({
  inputId,
  photoURL,
  onSelect,
  onRemove,
  onBeforePick,
  error,
  label = "Photo (optional)",
  ...rest
}: {
  inputId: string;
  photoURL: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** Called synchronously when the person clicks to open the file picker —
   *  BEFORE the OS-native dialog opens, not after they've chosen a file. Use
   *  this to kick off Drive's OAuth popup (preauthorizeDrive) here rather
   *  than in onSelect: browsers only allow opening a new popup window
   *  during a fresh, unbroken click, and the native file dialog can take
   *  any amount of time to close, so by the time onSelect/onChange fires
   *  that window has already expired and the popup gets silently blocked. */
  onBeforePick?: () => void;
  error?: string;
  label?: string;
} & FallbackProps) {
  const shape = rest.fallback === "icon" ? "14px" : "50%";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
      <div style={{ position: "relative", width: 76, height: 76 }}>
        <label
          htmlFor={inputId}
          onClick={onBeforePick}
          style={{
            display: "block",
            width: 76,
            height: 76,
            borderRadius: shape,
            cursor: "pointer",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <Avatar photoURL={photoURL} size={76} {...(rest as FallbackProps)} />
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
          onClick={onBeforePick}
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
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      )}
    </div>
  );
}
