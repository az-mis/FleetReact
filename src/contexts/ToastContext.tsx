import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    showSuccess: (message: string) => push("success", message),
    showError: (message: string) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Fixed + centered so it overlaps the page content instead of pushing
          it around, but placed top-center and sized up so it's impossible
          to miss (rather than a small top-right corner toast). */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          width: "min(420px, calc(100vw - 24px))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const isSuccess = toast.kind === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  const accent = isSuccess ? "var(--primary)" : "var(--danger)";

  return (
    <div
      role="status"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        width: "100%",
        padding: "16px 18px",
        borderRadius: "14px",
        background: "#fff",
        boxShadow: `0 20px 45px -12px rgba(0,0,0,0.28), 0 0 0 1px ${isSuccess ? "#c7ecd8" : "#fbd0d0"}`,
        overflow: "hidden",
        pointerEvents: "auto",
        animation: "toastDropIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Left accent bar makes the kind readable at a glance, even before
          reading the icon or copy. */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "5px", background: accent }} />

      <div
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isSuccess ? "#e6f7ee" : "#fff0f0",
          color: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "4px",
        }}
      >
        <Icon size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingTop: "3px" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.02em", color: accent, marginBottom: "2px" }}>
          {isSuccess ? "SUCCESS" : "SOMETHING WENT WRONG"}
        </div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#2d3748", lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          padding: "4px",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        <X size={15} />
      </button>

      {/* Depletes over AUTO_DISMISS_MS so users can see roughly how long
          they have left before it disappears on its own. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "3px",
          background: accent,
          opacity: 0.5,
          animation: `toastShrink ${AUTO_DISMISS_MS}ms linear forwards`,
          transformOrigin: "left",
        }}
      />
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
