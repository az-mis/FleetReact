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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              background: danger ? "#fff5f5" : "#eef2ff",
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div style={{ fontSize: "13.5px", color: "#4a5568", lineHeight: 1.5, marginTop: "6px" }}>{message}</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "#fff",
              color: "#2d3748",
              fontSize: "14px",
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
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: "14px",
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
