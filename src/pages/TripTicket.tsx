import React, { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { AppUser, ApprovingOfficer, VehicleRequest } from "../types";
import { ArrowLeft, Printer, AlertTriangle } from "lucide-react";
import { generateTripTicketNumber } from "../utils/ticketNumber";

import { checkRateLimit, recordAttempt, sanitizeInput } from "../utils/rateLimiter";

type LoadState = "loading" | "not_found" | "not_approved" | "error" | "ready" | "rate_limited";

const RATE_LIMIT_KEY = "view_trip_ticket";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 min

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

/** Names to print as authorized passenger(s) — the requester only appears here if they said
 *  they're actually riding along; otherwise the ticket lists just the named passengers. */
function passengerNames(request: VehicleRequest): string[] {
  const names = request.requesterIsPassenger ? [request.requesterName] : [];
  return [...names, ...(request.passengers || [])].filter(Boolean);
}

export default function TripTicket() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [request, setRequest] = useState<VehicleRequest | null>(null);
  const [vehicleLabel, setVehicleLabel] = useState<string>("");
  const [signatories, setSignatories] = useState<{
    s1Name: string;
    s1Title: string;
    s2Name: string;
    s2Title: string;
  }>({
    s1Name: "ARJAY D. BURGOS",
    s1Title: "OIC - APCO-Oriental Mindoro",
    s2Name: "EDGARDO F. LEIDO, Jr.",
    s2Title: "GSS Regional Office Calapan City",
  });

  useEffect(() => {
    const cleanId = sanitizeInput(id?.trim() || "", 20);
    if (!cleanId) return;

    const rateCheck = checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      setState("rate_limited");
      return;
    }

    recordAttempt(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW_MS);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "vehicleRequests", cleanId));
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

        // Resolve signatories: Request snapshot -> Approver User profile -> Location Admin -> Fallback defaults
        let s1Name = data.signee1Name || "";
        let s1Title = data.signee1Title || "";
        let s2Name = data.signee2Name || "";
        let s2Title = data.signee2Title || "";

        if ((!s1Name || !s2Name) && data.approvedBy) {
          try {
            const uSnap = await getDoc(doc(db, "users", data.approvedBy));
            if (uSnap.exists()) {
              const uData = uSnap.data() as AppUser;
              if (!s1Name && uData.signee1Name) s1Name = uData.signee1Name;
              if (!s1Title && uData.signee1Title) s1Title = uData.signee1Title;
              if (!s2Name && uData.signee2Name) s2Name = uData.signee2Name;
              if (!s2Title && uData.signee2Title) s2Title = uData.signee2Title;
            }
          } catch (err) {
            console.error("Could not fetch approving user signatories:", err);
          }
        }

        if ((!s1Name || !s2Name) && data.location) {
          try {
            const q = query(
              collection(db, "approvingOfficers"),
              where("location", "==", data.location)
            );
            const offSnap = await getDocs(q);
            if (!offSnap.empty) {
              const offData = offSnap.docs[0].data() as ApprovingOfficer;
              if (!s1Name && offData.signee1Name) s1Name = offData.signee1Name;
              if (!s1Title && offData.signee1Title) s1Title = offData.signee1Title;
              if (!s2Name && offData.signee2Name) s2Name = offData.signee2Name;
              if (!s2Title && offData.signee2Title) s2Title = offData.signee2Title;
            }
          } catch (err) {
            console.error("Could not fetch approving officers:", err);
          }
        }

        if ((!s1Name || !s2Name) && data.location) {
          try {
            const q = query(
              collection(db, "users"),
              where("role", "==", "admin"),
              where("location", "==", data.location)
            );
            const locAdmins = await getDocs(q);
            if (!locAdmins.empty) {
              const adminData = locAdmins.docs[0].data() as AppUser;
              if (!s1Name && adminData.signee1Name) s1Name = adminData.signee1Name;
              if (!s1Title && adminData.signee1Title) s1Title = adminData.signee1Title;
              if (!s2Name && adminData.signee2Name) s2Name = adminData.signee2Name;
              if (!s2Title && adminData.signee2Title) s2Title = adminData.signee2Title;
            }
          } catch (err) {
            console.error("Could not fetch location admin signatories:", err);
          }
        }

        setSignatories({
          s1Name: s1Name || "ARJAY D. BURGOS",
          s1Title: s1Title || "OIC - APCO-Oriental Mindoro",
          s2Name: s2Name || "EDGARDO F. LEIDO, Jr.",
          s2Title: s2Title || "GSS Regional Office Calapan City",
        });

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
  if (state === "rate_limited") {
    return (
      <CenteredMessage icon={AlertTriangle}>
        Too many requests. Please wait a minute before viewing this trip ticket again.
        <BackLink />
      </CenteredMessage>
    );
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
          .ticket-sheet { margin: 0 !important; box-shadow: none !important; }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      {/* The ticket itself */}
      <div
        className="ticket-sheet"
        style={{
          maxWidth: "210mm",
          minHeight: "297mm",
          margin: "24px auto",
          background: "#fff",
          fontFamily: "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif",
          fontSize: "12px",
          lineHeight: 1.22,
          color: "#1a1a1a",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Full-bleed header — spans the entire page width, no side margins, like the Word template */}
        <img
          src="/trip-ticket-header.png"
          alt="Department of Agriculture MIMAROPA Region"
          style={{ width: "100%", display: "block" }}
        />

        <div style={{ padding: "2mm 12mm 3mm" }}>
        <div style={{ textAlign: "right", fontSize: "11px", marginTop: "0" }}>Appendix A</div>

        <h1 style={{ textAlign: "center", fontSize: "17px", fontWeight: 700, letterSpacing: "0.75px", margin: "3px 0" }}>
          DRIVER'S TRIP TICKET
        </h1>

        <div style={{ textAlign: "right", fontSize: "12px", marginBottom: "4px" }}>
          <div>
            No. <U w={140}>{request.tripTicketNumber || generateTripTicketNumber(request.approvedAt?.toDate ? request.approvedAt.toDate() : new Date())}</U>
          </div>
          <div style={{ marginTop: "2px" }}>
            <U w={160}>
              {new Date(
                request.approvedAt?.toDate ? request.approvedAt.toDate() : Date.now()
              ).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </U>
          </div>
        </div>

        <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "3px" }}>
          A. To be filled by the Administrative Official Authorizing Official Travel:
        </p>

        <div style={{ lineHeight: 1.1 }}>
          <TicketRow n={1} label="Name of Driver of the vehicle" value={driverName} />
          <TicketRow n={2} label="Government car to be used, Plate No." value={plateLabel} />
          <TicketRow n={3} label="Name of authorized passenger" value={passengerNames(request).join(", ")} />
          <TicketRow n={4} label="Duration or Date of travel" value={durationLabel(request)} />
          <TicketRow n={5} label="Place or places to be visited" value={request.destination} />
          <div style={{ display: "flex", fontSize: "12px", marginBottom: "2px" }}>
            <div style={{ width: "20px", flexShrink: 0 }}>6</div>
            <div style={{ width: "220px", flexShrink: 0 }}>Purpose :</div>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "14px", whiteSpace: "pre-wrap" }}>
              {request.purpose}
            </div>
          </div>
          <TicketRow n={7} label="Previous date of Travel Trip Ticket" value={longDate(request.previousTripTicketDate)} />
        </div>

        <div style={{ marginTop: "5px", fontSize: "12px" }}>
          <div style={{ textAlign: "center" }}>Approved by:</div>
          <div style={{ width: "260px", marginLeft: "auto", marginTop: "3px" }}>
            <div style={{ minHeight: "20px" }} />
            <div style={{ borderTop: "1px solid #333", textAlign: "center", fontWeight: 700, paddingTop: "1px" }}>
              {signatories.s1Name}
            </div>
            <div style={{ fontSize: "10px", textAlign: "center" }}>
              {signatories.s1Title}
            </div>
          </div>

          <div style={{ width: "260px", marginLeft: "auto", marginTop: "6px" }}>
            <div style={{ minHeight: "20px" }} />
            <div style={{ borderTop: "1px solid #333", textAlign: "center", fontWeight: 700, paddingTop: "1px" }}>
              {signatories.s2Name}
            </div>
            <div style={{ fontSize: "10px", textAlign: "center" }}>
              {signatories.s2Title}
            </div>
          </div>
        </div>

        <p style={{ fontSize: "12px", fontWeight: 700, margin: "6px 0 3px" }}>
          B. To be filled by the Driver:
        </p>

        <div style={{ lineHeight: 1.1 }}>
          <DriverRow n={1} label="Time of departure for Office/Garage" suffix="a.m./p.m." />
          <DriverRow n={2} label="Time of arrival at (per No. 4 above)" suffix="a.m./p.m." />
          <DriverRow n={3} label="Time of departure from (per No. 4)" suffix="a.m./p.m." />
          <DriverRow n={4} label="Time of arrival back to Office/Garage" suffix="a.m./p.m." />
          <DriverRow n={5} label="Approximate distance travelled (to and from)" suffix="kms." />

          <div style={{ display: "flex", fontSize: "12px", marginBottom: "1px" }}>
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

          <div style={{ display: "flex", fontSize: "12px", marginBottom: "1px" }}>
            <div style={{ width: "20px", flexShrink: 0 }}>10</div>
            <div style={{ flex: 1 }}>Speedometer readings, if any:</div>
          </div>
          <SubRow label="At beginning of trip" suffix="miles/kms." />
          <SubRow label="At end of trip" suffix="miles/kms." />
          <SubRow label="Distance travelled (per 5 above)" suffix="miles/kms." />

          <DriverRow n={11} label="Remarks" suffix="" />
        </div>

        <p style={{ fontSize: "9.5px", marginTop: "4px", marginBottom: "0" }}>
          I hereby certify to the correctness of the above statement of record of travel.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "6px" }}>
          <div style={{ fontSize: "9.5px", maxWidth: "260px" }}>
            I hereby certify that I used this car on official business as stated above.
          </div>
          <div style={{ textAlign: "center", width: "220px" }}>
            <div style={{ fontWeight: 700, fontSize: "12px" }}>{driverName}</div>
            <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
            <div style={{ fontSize: "9.5px" }}>Driver</div>
          </div>
        </div>

        <div style={{ marginTop: "5px", textAlign: "center" }}>
          <div>{passengerNames(request).join(", ")}</div>
          <div style={{ borderTop: "1px solid #333", marginTop: "2px" }} />
          <div style={{ fontSize: "9.5px", marginTop: "1px" }}>Name of Passengers</div>
        </div>

        <div style={{ fontSize: "10px", color: "#333", marginTop: "3px", lineHeight: 1.2 }}>
          <div>Doc. No.: DAMIMAROPA-F083-2023</div>
          <div>Rev. No.: 0</div>
          <div>Issued Date: 10/23/23</div>
        </div>
        </div>
      </div>
    </div>
  );
}

/** A single numbered "label ......... value" row, matching the paper form. */
function TicketRow({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: "12px", marginBottom: "2px" }}>
      <div style={{ width: "20px", flexShrink: 0 }}>{n}</div>
      <div style={{ width: "220px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", paddingBottom: "1px" }}>{value}</div>
    </div>
  );
}

/** A numbered "label ___________ suffix" row for Section B, left blank for the driver to fill in by hand. */
function DriverRow({ n, label, suffix }: { n: number; label: string; suffix: string }) {
  return (
    <div style={{ display: "flex", fontSize: "12px", marginBottom: "2px", alignItems: "flex-end" }}>
      <div style={{ width: "20px", flexShrink: 0 }}>{n}</div>
      <div style={{ width: "260px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "10px" }} />
      {suffix && <div style={{ flexShrink: 0, marginLeft: "6px", fontSize: "10px" }}>{suffix}</div>}
    </div>
  );
}

/** An indented sub-row (a., b., c. ...) used under Section B's gasoline/speedometer items. */
function SubRow({ label, suffix, bold }: { label: string; suffix: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: "12px", marginBottom: "2px", alignItems: "flex-end", paddingLeft: "20px" }}>
      <div style={{ width: "260px", flexShrink: 0, fontWeight: bold ? 700 : 400 }}>{label}</div>
      <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: "10px" }} />
      {suffix && <div style={{ flexShrink: 0, marginLeft: "6px", fontSize: "10px" }}>{suffix}</div>}
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
