import React, { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

/**
 * In-app replacement for window.confirm(). The browser's native confirm()
 * dialog (the "localhost:5173 says..." box) looks broken/unbranded and its
 * copy, buttons, and styling can't be controlled — this renders through our
 * own Modal instead so destructive confirmations look and behave like the
 * rest of the app.
 *
 * Usage: keep a `AppUser | null` (or similar) piece of state for "the thing
 * pending deletion", render <ConfirmDialog open={!!target} .../> and do the
 * actual delete in onConfirm.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting...",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const accent = danger ? "var(--danger)" : "var(--primary)";

  return (
    <Modal title={title} onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              background: danger ? "rgba(229, 62, 62, 0.12)" : "rgba(26, 107, 60, 0.12)",
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div style={{ fontSize: "12.5px", color: "#4a5568", lineHeight: 1.45, marginTop: "4px" }}>{message}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              height: "36px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "#fff",
              color: "#2d3748",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
