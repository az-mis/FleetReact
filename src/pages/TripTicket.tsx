import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { VehicleRequest } from "../types";
import { ArrowLeft, Printer, AlertTriangle } from "lucide-react";

type LoadState = "loading" | "not_found" | "not_approved" | "error" | "ready";

/** yyyy-mm-dd -> "July 24, 2026" */
function longDate(value?: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Combines travelDate/travelDateEnd into the ticket's "Duration or Date of travel" line. */
function durationLabel(request: VehicleRequest): string {
  const start = longDate(request.travelDate);
  if (!request.travelDateEnd || request.travelDateEnd === request.travelDate) return start;
  return `${start} to ${longDate(request.travelDateEnd)}`;
}

export default function TripTicket() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [request, setRequest] = useState<VehicleRequest | null>(null);
  const [vehicleLabel, setVehicleLabel] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "vehicleRequests", id));
        if (!snap.exists()) {
          setState("not_found");
          return;
        }
        const data = { id: snap.id, ...(snap.data() as Omit<VehicleRequest, "id">) };
        if (data.status !== "approved") {
          setState("not_approved");
          return;
        }
        setRequest(data);
        // Brand/model isn't snapshotted on the request, so look it up from
        // the vehicle doc to prefix the plate number (e.g. "Toyota Vios").
        if (data.vehicleId) {
          try {
            const vSnap = await getDoc(doc(db, "vehicles", data.vehicleId));
            if (vSnap.exists()) {
              const v = vSnap.data() as { brand?: string; model?: string };
              setVehicleLabel([v.brand, v.model].filter(Boolean).join(" "));
            }
          } catch {
            // Non-fatal — the ticket still works with just the plate number.
          }
        }
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, [id]);

  if (state === "loading") {
    return <CenteredMessage>Loading trip ticket…</CenteredMessage>;
  }
  if (state === "not_found") {
    return (
      <CenteredMessage icon={AlertTriangle}>
        We couldn't find that request.
        <BackLink />
      </CenteredMessage>
    );
  }
  if (state === "not_approved") {
    return (
      <CenteredMessage icon={AlertTriangle}>
        This request hasn't been approved yet, so there's no trip ticket to print.
        <BackLink />
      </CenteredMessage>
    );
  }
  if (state === "error" || !request) {
    return (
      <CenteredMessage icon={AlertTriangle}>
        Something went wrong loading this trip ticket. Please try again.
        <BackLink />
      </CenteredMessage>
    );
  }

  const driverName = request.confirmedDriverName || request.defaultDriverName || "";
  const plateLabel = vehicleLabel ? `${vehicleLabel}, ${request.vehiclePlateNumber}` : request.vehiclePlateNumber;

  return (
    <div style={{ background: "#e9ebee", minHeight: "100vh" }}>
      {/* Toolbar — hidden when printing */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          to={`/check-status?code=${request.id}`}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}
        >
          <ArrowLeft size={15} /> Back to status
        </Link>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
          }}
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      {/* The ticket itself */}
      <div
        style={{
          maxWidth: "210mm",
          minHeight: "297mm",
          margin: "24px auto",
          background: "#fff",
          padding: "12mm 15mm",
          fontFamily: "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif",
          fontSize: "13px",
          lineHeight: 1.4,
          color: "#1a1a1a",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "right", fontSize: "12px", marginTop: "4px" }}>Appendix A</div>

        <h1 style={{ textAlign: "center", fontSize: "20px", fontWeight: 700, letterSpacing: "0.75px", margin: "10px 0" }}>
          DRIVER'S TRIP TICKET
        </h1>

        <div style={{ textAlign: "right", fontSize: "13px", marginBottom: "10px" }}>
          <div>
            No. <U w={90}>{request.id}</U>
          </div>
          <div style={{ marginTop: "4px" }}>
            <U w={160}>
              {new Date(
                request.approvedAt?.toDate ? request.approvedAt.toDate() : Date.now()
              ).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </U>
          </div>
        </div>

        <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
          A. To be filled by the Administrative Official Authorizing Official Travel:
        </p>

        <div style={{ lineHeight: 1.2 }}>
          <TicketRow n={1} label="Name of Driver of the vehicle" value={driverName} />
          <TicketRow n={2} label="Government car to be used, Plate No." value={plateLabel} />
          <TicketRow n={3} label="Name of authorized passenger" value={[request.requesterName, request.passengers].filter(Boolean).join(", ")} />
          <TicketRow n={4} label="Duration or Date of travel" value={durationLabel(request)} />
          <TicketRow n={5} label="Place or places to be visited" value={request.destination} />
          <div style={{ display: "flex", fontSize: "13px", marginBottom: "5px" }}>
            <div style={{ width: "20px", flexShrink: 0 }}>6</div>
            <div style={{ width: "220px", flexShrink: 0 }}>Purpose :</div>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "18px", whiteSpace: "pre-wrap" }}>
              {request.purpose}
            </div>
          </div>
          <TicketRow n={7} label="Previous date of Travel Trip Ticket" value={longDate(request.previousTripTicketDate)} />
        </div>

        <div style={{ marginTop: "14px", fontSize: "13px", textAlign: "right" }}>
          <div>Approved by:</div>
          <div style={{ display: "block", textAlign: "center", width: "230px", marginLeft: "auto", marginTop: "20px" }}>
            <div style={{ fontWeight: 700 }}>ARJAY D. BURGOS</div>
            <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
            <div style={{ fontSize: "11px" }}>OIC - APCO-Oriental Mindoro</div>
          </div>

          <div style={{ display: "block", textAlign: "center", width: "230px", marginLeft: "auto", marginTop: "16px" }}>
            <div style={{ fontWeight: 700 }}>EDGARDO F. LEIDO, Jr.</div>
            <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
            <div style={{ fontSize: "11px" }}>GSS Regional Office Calapan City</div>
          </div>
        </div>

        <p style={{ fontSize: "13px", fontWeight: 700, margin: "16px 0 6px" }}>
          B. To be filled by the Driver:
        </p>

        <div style={{ lineHeight: 1.2 }}>
          <DriverRow n={1} label="Time of departure for Office/Garage" suffix="a.m./p.m." />
          <DriverRow n={2} label="Time of arrival at (per No. 4 above)" suffix="a.m./p.m." />
          <DriverRow n={3} label="Time of departure from (per No. 4)" suffix="a.m./p.m." />
          <DriverRow n={4} label="Time of arrival back to Office/Garage" suffix="a.m./p.m." />
          <DriverRow n={5} label="Approximate distance travelled (to and from)" suffix="kms." />

          <div style={{ display: "flex", fontSize: "13px", marginBottom: "3px" }}>
            <div style={{ width: "20px", flexShrink: 0 }}>6</div>
            <div style={{ flex: 1 }}>Gasoline issued, purchase and consumed:</div>
          </div>
          <SubRow label="a. Balance in tank" suffix="liters" />
          <SubRow label="b. Issued by office from stock" suffix="liters" />
          <SubRow label="c. Add-purchased during trip" suffix="liters" />
          <SubRow label="Total" suffix="liters" bold />
          <SubRow label="d. Deduct: Used during the trip (to and from)" suffix="liters" />
          <SubRow label="e. Balance in tank at the end of trip" suffix="liters" />

          <DriverRow n={7} label="Gear oil issued" suffix="liters" />
          <DriverRow n={8} label="Lub oil issued" suffix="liters" />
          <DriverRow n={9} label="Grease issued" suffix="liters" />

          <div style={{ display: "flex", fontSize: "13px", marginBottom: "3px" }}>
            <div style={{ width: "20px", flexShrink: 0 }}>10</div>
            <div style={{ flex: 1 }}>Speedometer readings, if any:</div>
          </div>
          <SubRow label="At beginning of trip" suffix="miles/kms." />
          <SubRow label="At end of trip" suffix="miles/kms." />
          <SubRow label="Distance travelled (per 5 above)" suffix="miles/kms." />

          <DriverRow n={11} label="Remarks" suffix="" />
        </div>

        <p style={{ fontSize: "11px", marginTop: "10px", marginBottom: "0" }}>
          I hereby certify to the correctness of the above statement of record of travel.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "22px" }}>
          <div style={{ fontSize: "11px", maxWidth: "260px" }}>
            I hereby certify that I used this car on official business as stated above.
          </div>
          <div style={{ textAlign: "center", width: "220px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>{driverName}</div>
            <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
            <div style={{ fontSize: "11px" }}>Driver</div>
          </div>
        </div>

        <div style={{ marginTop: "22px", textAlign: "center" }}>
          <div>{[request.requesterName, request.passengers].filter(Boolean).join(", ")}</div>
          <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
          <div style={{ fontSize: "11px", marginTop: "2px" }}>Name of Passengers</div>
        </div>

        <div style={{ fontSize: "10px", color: "#444", marginTop: "20px" }}>
          <div>Doc. No.: DAMIMAROPA-F083-2023</div>
          <div>Rev. No.: 0</div>
          <div>Issued Date: 10/23/23</div>
        </div>
      </div>
    </div>
  );
}

/** A single numbered "label ......... value" row, matching the paper form. */
function TicketRow({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: "13px", marginBottom: "5px" }}>
      <div style={{ width: "20px", flexShrink: 0 }}>{n}</div>
      <div style={{ width: "220px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", paddingBottom: "2px" }}>{value}</div>
    </div>
  );
}

/** A numbered "label ___________ suffix" row for Section B, left blank for the driver to fill in by hand. */
function DriverRow({ n, label, suffix }: { n: number; label: string; suffix: string }) {
  return (
    <div style={{ display: "flex", fontSize: "13px", marginBottom: "5px", alignItems: "flex-end" }}>
      <div style={{ width: "20px", flexShrink: 0 }}>{n}</div>
      <div style={{ width: "260px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "14px" }} />
      {suffix && <div style={{ flexShrink: 0, marginLeft: "6px", fontSize: "11px" }}>{suffix}</div>}
    </div>
  );
}

/** An indented sub-row (a., b., c. ...) used under Section B's gasoline/speedometer items. */
function SubRow({ label, suffix, bold }: { label: string; suffix: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: "13px", marginBottom: "5px", alignItems: "flex-end", paddingLeft: "20px" }}>
      <div style={{ width: "260px", flexShrink: 0, fontWeight: bold ? 700 : 400 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "14px" }} />
      {suffix && <div style={{ flexShrink: 0, marginLeft: "6px", fontSize: "11px" }}>{suffix}</div>}
    </div>
  );
}

function U({ children, w }: { children: React.ReactNode; w: number }) {
  return (
    <span style={{ display: "inline-block", minWidth: `${w}px`, borderBottom: "1px solid #333" }}>{children}</span>
  );
}

function CenteredMessage({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: any;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        textAlign: "center",
        padding: "24px",
        color: "var(--text-muted)",
        fontSize: "14px",
      }}
    >
      {Icon && <Icon size={28} />}
      <div>{children}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/check-status"
      style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--primary)", marginTop: "8px" }}
    >
      <ArrowLeft size={14} /> Back to status lookup
    </Link>
  );
}
