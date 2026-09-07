import React, { useEffect, useState, FormEvent } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { useBranding } from "../contexts/BrandingContext";
import { VehicleRequest } from "../types";
import { formatTravelDateRange } from "../utils/travelDate";
import {
  Search,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  MapPin,
  CalendarDays,
  User,
  Printer,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Loader2,
  LogIn,
} from "lucide-react";

type LookupState = "idle" | "loading" | "not_found" | "found" | "error";

export default function CheckStatus() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() || "");
  const [state, setState] = useState<LookupState>("idle");
  const [request, setRequest] = useState<VehicleRequest | null>(null);
  const { branding } = useBranding();

  async function lookup(rawCode: string) {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned) return;
    setState("loading");
    try {
      const snap = await getDoc(doc(db, "vehicleRequests", cleaned));
      if (snap.exists()) {
        setRequest({ id: snap.id, ...(snap.data() as Omit<VehicleRequest, "id">) });
        setState("found");
      } else {
        setRequest(null);
        setState("not_found");
      }
    } catch {
      setRequest(null);
      setState("error");
    }
  }

  useEffect(() => {
    const initial = searchParams.get("code");
    if (initial) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    lookup(code);
  }

  const hasCustomBg = !!branding?.loginBackgroundURL;

  return (
    <div
      className={`portal-container${hasCustomBg ? " portal-container--custom-bg" : ""}`}
      style={
        hasCustomBg
          ? ({ "--custom-bg": `url(${branding!.loginBackgroundURL})` } as React.CSSProperties)
          : undefined
      }
    >
      <div className="login-bg-glow" aria-hidden="true" />

      <main className="portal-wrapper fade-in">
        <nav className="portal-top-nav">
          <Link to="/request-vehicle" className="portal-back-link">
            <ArrowLeft size={14} />
            <span>Request Form</span>
          </Link>
          <div className="portal-nav-badge">
            <Search size={12} />
            <span>Status Portal</span>
          </div>
          <Link to="/login" className="portal-back-link">
            <span>Staff Login</span>
            <LogIn size={13} />
          </Link>
        </nav>

        <header className="portal-header">
          <div className="portal-header-icon">
            {branding?.logoURL ? (
              <img src={branding.logoURL} alt="Logo" />
            ) : (
              <Search size={22} />
            )}
          </div>
          <h1 className="portal-title">Check Request Status</h1>
          <p className="portal-subtitle">
            Enter your 7-character reference code to view real-time trip approval,
            assigned driver details, and access your printable Trip Ticket.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px" }}>
          <div className="portal-input-wrapper" style={{ flex: 1 }}>
            <Search size={17} className="portal-input-icon" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7K4RXWM"
              maxLength={12}
              style={{
                letterSpacing: "1.5px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={state === "loading" || !code.trim()}
            className="portal-submit-btn"
            style={{ padding: "0 22px", flexShrink: 0 }}
          >
            {state === "loading" ? (
              <Loader2 size={16} className="spin" />
            ) : (
              "Check Status"
            )}
          </button>
        </form>

        {state === "not_found" && (
          <div
            className="fade-in"
            style={{
              padding: "20px",
              background: "#fffaf0",
              border: "1px solid #feebc8",
              borderRadius: "14px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={24} color="#dd6b20" />
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#7b341e" }}>
              No Request Found
            </div>
            <div style={{ fontSize: "13px", color: "#744210", maxWidth: "360px" }}>
              We couldn't find a record for reference code <b>"{code}"</b>. Please verify the code and try again.
            </div>
          </div>
        )}

        {state === "error" && (
          <div
            className="fade-in"
            style={{
              padding: "16px 18px",
              background: "#fff5f5",
              border: "1px solid #fed7d7",
              borderRadius: "14px",
              color: "var(--danger)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertTriangle size={18} />
            <span>Something went wrong looking up your request. Please try again.</span>
          </div>
        )}

        {state === "found" && request && <RequestStatusCard request={request} />}

        {state === "idle" && (
          <div className="portal-info-box">
            <b>Where do I find my reference code?</b>
            <p style={{ marginTop: "4px", color: "var(--text-muted)" }}>
              Your 7-character code was generated when you submitted the vehicle request form (e.g. <code>7K4RXWM</code>).
            </p>
          </div>
        )}

        <footer className="portal-card-footer">
          <div className="login-security-note">
            <ShieldCheck size={14} />
            <span>Official Government Fleet Management System</span>
          </div>
          <p className="login-copyright">
            &copy; {new Date().getFullYear()} Vehicle Monitoring &amp; Management System
          </p>
        </footer>
      </main>
    </div>
  );
}

const STATUS_META: Record<
  VehicleRequest["status"],
  { label: string; color: string; bg: string; border: string; icon: any; desc: string }
> = {
  pending: {
    label: "Pending Review",
    color: "#b7791f",
    bg: "#fffbea",
    border: "#fef3c7",
    icon: Clock,
    desc: "Your request is in the admin queue awaiting review and vehicle assignment.",
  },
  approved: {
    label: "Trip Approved",
    color: "#1a6b3c",
    bg: "#e6f7ee",
    border: "#c6f6d5",
    icon: CheckCircle2,
    desc: "Your trip has been officially approved. You may now download and print your Trip Ticket.",
  },
  declined: {
    label: "Request Declined",
    color: "#c53030",
    bg: "#fff5f5",
    border: "#fed7d7",
    icon: XCircle,
    desc: "This request could not be approved at this time.",
  },
};

function RequestStatusCard({ request }: { request: VehicleRequest }) {
  const meta = STATUS_META[request.status];
  const StatusIcon = meta.icon;
  const driverName = request.confirmedDriverName || request.defaultDriverName;

  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "16px",
          borderRadius: "14px",
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          color: meta.color,
        }}
      >
        <div style={{ marginTop: "2px" }}>
          <StatusIcon size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "15px" }}>{meta.label}</div>
          <div style={{ fontSize: "12.5px", marginTop: "2px", opacity: 0.9 }}>
            {meta.desc}
          </div>
        </div>
      </div>

      {request.status === "declined" && request.declineReason && (
        <div
          style={{
            fontSize: "13px",
            color: "#742a2a",
            background: "#fff5f5",
            border: "1px solid #fed7d7",
            borderRadius: "10px",
            padding: "12px 14px",
          }}
        >
          <b>Reason for decline:</b> {request.declineReason}
        </div>
      )}

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <DetailItem icon={Truck} label="Vehicle" value={request.vehiclePlateNumber} />
        {request.status === "approved" && (
          <DetailItem icon={User} label="Assigned Driver" value={driverName || "Assigned on dispatch"} />
        )}
        <DetailItem icon={MapPin} label="Destination" value={request.destination} />
        <DetailItem
          icon={CalendarDays}
          label="Travel Date"
          value={formatTravelDateRange(request.travelDate, request.travelDateEnd)}
        />
        {request.requesterOffice && (
          <DetailItem icon={Building2} label="Office / Section" value={request.requesterOffice} />
        )}
        <DetailItem icon={User} label="Requester" value={request.requesterName} />
      </div>

      {request.status === "approved" && (
        <Link
          to={`/trip-ticket/${request.id}`}
          className="portal-submit-btn"
          style={{ textDecoration: "none" }}
        >
          <Printer size={16} />
          <span>Download / Print Trip Ticket</span>
        </Link>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          background: "#edf2f7",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "2px",
        }}
      >
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#2d3748", marginTop: "1px", wordBreak: "break-word" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
