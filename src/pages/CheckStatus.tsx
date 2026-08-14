import React, { useEffect, useState, FormEvent } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
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
} from "lucide-react";

type LookupState = "idle" | "loading" | "not_found" | "found" | "error";

export default function CheckStatus() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() || "");
  const [state, setState] = useState<LookupState>("idle");
  const [request, setRequest] = useState<VehicleRequest | null>(null);

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

  // Auto-lookup if a code was passed in via ?code=
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)",
        padding: "32px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <Link
          to="/request-vehicle"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12.5px",
            color: "rgba(255,255,255,0.8)",
            textDecoration: "none",
            marginBottom: "14px",
          }}
        >
          <ArrowLeft size={13} /> Back to request form
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", color: "#fff" }}>
          <Search size={22} />
          <h1 style={{ fontSize: "19px", fontWeight: 700 }}>Check Request Status</h1>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "20px" }}>
          Enter the reference code you received when you submitted your vehicle request.
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7K4RXWM"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "15px",
                letterSpacing: "2px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            />
            <button
              type="submit"
              disabled={state === "loading" || !code.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13.5px",
              }}
            >
              {state === "loading" ? "..." : "Check"}
            </button>
          </form>

          {state === "not_found" && (
            <div style={{ textAlign: "center", padding: "12px 4px", color: "var(--text-muted)", fontSize: "13.5px" }}>
              No request found for that code. Double-check it and try again.
            </div>
          )}

          {state === "error" && (
            <div style={{ textAlign: "center", padding: "12px 4px", color: "var(--danger)", fontSize: "13.5px" }}>
              Something went wrong looking that up. Please try again.
            </div>
          )}

          {state === "found" && request && <RequestStatusCard request={request} />}

          {state === "idle" && (
            <div style={{ textAlign: "center", padding: "12px 4px", color: "var(--text-muted)", fontSize: "13px" }}>
              Your reference code was shown after you submitted your request.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_META: Record<
  VehicleRequest["status"],
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: { label: "Pending review", color: "#b7791f", bg: "#fffbea", icon: Clock },
  approved: { label: "Approved", color: "#1a6b3c", bg: "#e6f7ee", icon: CheckCircle2 },
  declined: { label: "Declined", color: "#c53030", bg: "#fff5f5", icon: XCircle },
};

function RequestStatusCard({ request }: { request: VehicleRequest }) {
  const meta = STATUS_META[request.status];
  const StatusIcon = meta.icon;
  const driverName = request.confirmedDriverName || request.defaultDriverName;

  return (
    <div className="fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          background: meta.bg,
          color: meta.color,
          fontWeight: 700,
          fontSize: "14px",
          marginBottom: "16px",
        }}
      >
        <StatusIcon size={18} />
        {meta.label}
      </div>

      {request.status === "declined" && request.declineReason && (
        <div
          style={{
            fontSize: "12.5px",
            color: "#742a2a",
            background: "#fff5f5",
            border: "1px solid #fed7d7",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "16px",
          }}
        >
          <b>Reason:</b> {request.declineReason}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#2d3748" }}>
        <DetailRow icon={Truck} label="Vehicle" value={request.vehiclePlateNumber} />
        {request.status === "approved" && (
          <DetailRow icon={User} label="Driver" value={driverName || "Not yet assigned"} />
        )}
        <DetailRow icon={MapPin} label="Destination" value={request.destination} />
        <DetailRow icon={CalendarDays} label="Travel date" value={formatTravelDateRange(request.travelDate, request.travelDateEnd)} />
      </div>

      {request.status === "approved" && (
        <Link
          to={`/trip-ticket/${request.id}`}
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "11px 16px",
            borderRadius: "8px",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "13.5px",
            textDecoration: "none",
          }}
        >
          <Printer size={15} /> Download / Print Trip Ticket
        </Link>
      )}

      {request.status === "pending" && (
        <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Your request hasn't been reviewed yet. Check back later, or contact your office if your
          travel date is coming up soon.
        </p>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <Icon size={14} style={{ marginTop: "2px", color: "var(--text-muted)", flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</div>
        <div style={{ fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}
