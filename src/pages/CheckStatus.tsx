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

import { checkRateLimit, recordAttempt, sanitizeInput } from "../utils/rateLimiter";

type LookupState = "idle" | "loading" | "not_found" | "found" | "error" | "rate_limited";

// Rate limit: Max 12 lookups per minute per client device
const RATE_LIMIT_KEY = "lookup_status_request";
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 min

export default function CheckStatus() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() || "");
  const [state, setState] = useState<LookupState>("idle");
  const [rateLimitWait, setRateLimitWait] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [request, setRequest] = useState<VehicleRequest | null>(null);
  const { branding } = useBranding();

  async function lookup(rawCode: string) {
    // Honeypot check
    if (honeypot) {
      setRequest(null);
      setState("not_found");
      return;
    }

    const cleaned = sanitizeInput(rawCode.trim().toUpperCase(), 12);
    if (!cleaned) return;

    // Check rate limit
    const rateCheck = checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      setRateLimitWait(rateCheck.waitTimeSeconds);
      setState("rate_limited");
      return;
    }

    recordAttempt(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW_MS);
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

  return (
    <div className="portal-container">
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
          {/* Anti-bot honeypot field */}
          <div style={{ display: "none", position: "absolute", left: "-9999px" }} aria-hidden="true">
            <input
              type="text"
              name="lookup_hp"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

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

        {state === "rate_limited" && (
          <div
            className="fade-in"
            style={{
              padding: "16px",
              background: "rgba(220, 38, 38, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "12px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={24} style={{ color: "#f87171" }} />
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#fecaca" }}>
              Rate Limit Reached
            </div>
            <div style={{ fontSize: "12.5px", color: "rgba(255, 255, 255, 0.75)", maxWidth: "380px" }}>
              Too many lookup attempts. Please wait {rateLimitWait} seconds before trying again.
            </div>
          </div>
        )}

        {state === "not_found" && (
          <div
            className="fade-in"
            style={{
              padding: "16px",
              background: "rgba(180, 100, 20, 0.25)",
              border: "1px solid rgba(237, 137, 54, 0.4)",
              borderRadius: "12px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <AlertTriangle size={20} color="#f6ad55" />
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#feebc8" }}>
              No Request Found
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)", maxWidth: "360px" }}>
              We couldn't find a record for reference code <b>"{code}"</b>. Please verify the code and try again.
            </div>
          </div>
        )}

        {state === "error" && (
          <div
            className="fade-in"
            style={{
              padding: "14px 16px",
              background: "rgba(180, 40, 40, 0.3)",
              border: "1px solid rgba(245, 101, 101, 0.45)",
              borderRadius: "12px",
              color: "#fed7d7",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <AlertTriangle size={16} />
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
    color: "#f6ad55",
    bg: "rgba(221, 107, 32, 0.22)",
    border: "rgba(237, 137, 54, 0.4)",
    icon: Clock,
    desc: "Your request is in the queue awaiting review and vehicle assignment.",
  },
  approved: {
    label: "Trip Approved",
    color: "#72ebb0",
    bg: "rgba(72, 187, 120, 0.22)",
    border: "rgba(72, 187, 120, 0.45)",
    icon: CheckCircle2,
    desc: "Your trip is approved. You may now download and print your Trip Ticket.",
  },
  declined: {
    label: "Request Declined",
    color: "#fc8181",
    bg: "rgba(229, 62, 62, 0.22)",
    border: "rgba(245, 101, 101, 0.4)",
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
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "12px",
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          color: meta.color,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div style={{ marginTop: "2px" }}>
          <StatusIcon size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "14px" }}>{meta.label}</div>
          <div style={{ fontSize: "12px", marginTop: "2px", opacity: 0.95, color: "rgba(255, 255, 255, 0.85)" }}>
            {meta.desc}
          </div>
        </div>
      </div>

      {request.status === "declined" && request.declineReason && (
        <div
          style={{
            fontSize: "12px",
            color: "#fed7d7",
            background: "rgba(180, 40, 40, 0.3)",
            border: "1px solid rgba(245, 101, 101, 0.4)",
            borderRadius: "10px",
            padding: "10px 12px",
          }}
        >
          <b>Reason for decline:</b> {request.declineReason}
        </div>
      )}

      <div
        style={{
          background: "rgba(0, 0, 0, 0.22)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: "12px",
          padding: "14px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
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
          <Printer size={15} />
          <span>Download / Print Trip Ticket</span>
        </Link>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <div
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "7px",
          background: "rgba(72, 187, 120, 0.18)",
          color: "#72ebb0",
          border: "1px solid rgba(72, 187, 120, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontWeight: 600, fontSize: "12.5px", color: "#ffffff", marginTop: "1px", wordBreak: "break-word" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
