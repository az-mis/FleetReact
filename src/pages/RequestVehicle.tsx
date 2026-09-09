import React, { useEffect, useState, FormEvent } from "react";
import { doc, setDoc, collection, onSnapshot, orderBy, query, where, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useBranding } from "../contexts/BrandingContext";
import { Vehicle, VehicleAvailability } from "../types";
import { OFFICES } from "../data/offices";
import SearchableSelect from "../components/SearchableSelect";
import {
  Truck,
  CheckCircle2,
  User,
  Building2,
  Phone,
  MapPin,
  CalendarDays,
  FileText,
  Users,
  Search,
  Copy,
  AlertTriangle,
  LogIn,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Plus,
  X,
} from "lucide-react";

// Chars chosen to avoid visual confusion when staff read this off a phone
// screen or write it down (no 0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateReferenceCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
];

const emptyForm = {
  requesterName: "",
  location: "",
  requesterOffice: "",
  requesterContact: "",
  requesterIsPassenger: false,
  vehicleId: "",
  purpose: "",
  destination: "",
  travelDate: "",
  travelDateEnd: "",
  passengers: [""] as string[],
  previousTripTicketDate: "",
};

import { checkRateLimit, recordAttempt, sanitizeInput } from "../utils/rateLimiter";

// Rate limit: Max 4 requests per 5 minutes per client device
const RATE_LIMIT_KEY = "submit_vehicle_request";
const RATE_LIMIT_MAX = 4;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 mins

export default function RequestVehicle() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [vehicleAvailability, setVehicleAvailability] = useState<VehicleAvailability[]>([]);
  const { branding } = useBranding();

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("plateNumber"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!form.vehicleId) {
      setVehicleAvailability([]);
      return;
    }
    const q = query(collection(db, "vehicleAvailability"), where("vehicleId", "==", form.vehicleId));
    const unsub = onSnapshot(q, (snap) => {
      setVehicleAvailability(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleAvailability, "id">) }))
      );
    });
    return unsub;
  }, [form.vehicleId]);

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicleId) || null;

  // Only show vehicles assigned to the selected location (or unassigned vehicles as fallback to all if no location).
  const locationFilteredVehicles = form.location
    ? vehicles.filter((v) => !v.location || v.location === form.location)
    : vehicles;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // 1. Honeypot check: If filled, fake successful submission to trick bots
    if (honeypot) {
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        setReferenceCode("SUCCESS");
        setSubmitted(true);
      }, 1000);
      return;
    }

    // 2. Client-side Rate limiting check
    const rateCheck = checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      setError(
        `Too many request submissions. For security, please wait ${rateCheck.waitTimeSeconds} seconds before submitting again.`
      );
      return;
    }

    if (!form.location) {
      setError("Please select a location.");
      return;
    }
    if (!form.vehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    if (form.travelDateEnd && form.travelDateEnd < form.travelDate) {
      setError("The return date can't be before the start date.");
      return;
    }

    // Sanitize user inputs
    const sanitizedRequester = sanitizeInput(form.requesterName, 120);
    const sanitizedOffice = sanitizeInput(form.requesterOffice, 150);
    const sanitizedContact = sanitizeInput(form.requesterContact, 40);
    const sanitizedPurpose = sanitizeInput(form.purpose, 500);
    const sanitizedDestination = sanitizeInput(form.destination, 250);
    const sanitizedPassengers = form.passengers
      .map((p) => sanitizeInput(p, 120))
      .filter(Boolean);

    if (!sanitizedRequester) {
      setError("Requester name is required.");
      return;
    }
    if (!sanitizedPurpose) {
      setError("Purpose is required.");
      return;
    }
    if (!sanitizedDestination) {
      setError("Destination is required.");
      return;
    }

    setSubmitting(true);
    try {
      const code = generateReferenceCode();
      await setDoc(doc(db, "vehicleRequests", code), {
        requesterName: sanitizedRequester,
        location: form.location,
        requesterOffice: sanitizedOffice || null,
        requesterContact: sanitizedContact || null,
        requesterIsPassenger: form.requesterIsPassenger,
        vehicleId: selectedVehicle!.id,
        vehiclePlateNumber: selectedVehicle!.plateNumber,
        defaultDriverId: selectedVehicle!.assignedDriverId || null,
        defaultDriverName: selectedVehicle!.assignedDriverName || null,
        purpose: sanitizedPurpose,
        destination: sanitizedDestination,
        travelDate: form.travelDate,
        travelDateEnd: form.travelDateEnd || null,
        passengers: sanitizedPassengers.length > 0 ? sanitizedPassengers : null,
        previousTripTicketDate: form.previousTripTicketDate || null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await setDoc(doc(db, "vehicleAvailability", code), {
          vehicleId: selectedVehicle!.id,
          travelDate: form.travelDate,
          travelDateEnd: form.travelDateEnd || null,
          status: "pending",
        });
      } catch (availErr) {
        console.error("Couldn't mirror request into vehicleAvailability:", availErr);
      }

      recordAttempt(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW_MS);
      setReferenceCode(code);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="fade-in" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(72, 187, 120, 0.18)",
              color: "#72ebb0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              border: "1px solid rgba(72, 187, 120, 0.4)",
              boxShadow: "0 0 20px rgba(72, 187, 120, 0.25)",
            }}
          >
            <CheckCircle2 size={28} />
          </div>

          <div>
            <h2 className="portal-title">Request Submitted!</h2>
            <p className="portal-subtitle" style={{ maxWidth: "420px", margin: "4px auto 0" }}>
              Your vehicle request is now pending admin review. Please copy and save your reference code below to track approval status.
            </p>
          </div>

          <div
            style={{
              background: "rgba(0, 0, 0, 0.25)",
              border: "1.5px dashed rgba(72, 187, 120, 0.4)",
              borderRadius: "12px",
              padding: "14px 16px",
              margin: "4px 0",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255, 255, 255, 0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Your Unique Reference Code
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "2.5px", color: "#72ebb0" }}>
                {referenceCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(referenceCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                title="Copy reference code"
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "7px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#ffffff",
                  transition: "all 0.15s ease",
                }}
              >
                <Copy size={15} />
              </button>
            </div>
            {copied && (
              <div className="fade-in" style={{ fontSize: "11px", color: "#72ebb0", fontWeight: 700 }}>
                ✓ Copied to clipboard!
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link
              to={`/check-status?code=${referenceCode}`}
              className="portal-submit-btn"
              style={{ textDecoration: "none" }}
            >
              <Search size={15} />
              <span>Check Request Status</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setSubmitted(false);
              }}
              style={{
                height: "38px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "rgba(255, 255, 255, 0.85)",
                fontWeight: 600,
                fontSize: "12.5px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Anti-bot honeypot field — hidden from genuine users */}
        <div style={{ display: "none", position: "absolute", left: "-9999px" }} aria-hidden="true">
          <input
            type="text"
            name="website_hp"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {error && (
          <div className="login-alert" role="alert">
            <AlertTriangle size={17} className="login-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <div className="portal-field-group">
          <label className="portal-field-label">
            <User size={14} />
            <span>Your Full Name <span style={{ color: "var(--danger)" }}>*</span></span>
          </label>
          <div className="portal-input-wrapper">
            <User size={17} className="portal-input-icon" />
            <input
              required
              value={form.requesterName}
              onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            fontSize: "13px",
            color: "#4a5568",
            cursor: "pointer",
            marginTop: "-6px",
          }}
        >
          <input
            type="checkbox"
            checked={form.requesterIsPassenger}
            onChange={(e) => setForm({ ...form, requesterIsPassenger: e.target.checked })}
            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--primary)" }}
          />
          <span style={{color:"white"}}>I am riding along on this trip as a passenger</span>
        </label>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <MapPin size={14} />
            <span>Location / Office Province <span style={{ color: "var(--danger)" }}>*</span></span>
          </label>
          <div className="portal-input-wrapper">
            <MapPin size={17} className="portal-input-icon" />
            <select
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value, vehicleId: "" })}
            >
              <option value="">— Select Location / Building —</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <Building2 size={14} />
            <span>Office / Section (Optional)</span>
          </label>
          <SearchableSelect
            value={form.requesterOffice}
            options={OFFICES.map((o) => ({ value: o.label, label: o.label }))}
            onChange={(v) => setForm({ ...form, requesterOffice: v })}
            placeholder="— Select your office / division —"
            searchPlaceholder="Search office..."
          />
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <Phone size={14} />
            <span>Contact Number (Optional)</span>
          </label>
          <div className="portal-input-wrapper">
            <Phone size={17} className="portal-input-icon" />
            <input
              value={form.requesterContact}
              onChange={(e) => setForm({ ...form, requesterContact: e.target.value })}
              placeholder="09XX-XXX-XXXX"
            />
          </div>
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <Truck size={14} />
            <span>Select Vehicle <span style={{ color: "var(--danger)" }}>*</span></span>
          </label>
          <div className="portal-input-wrapper">
            <Truck size={17} className="portal-input-icon" />
            <select
              required
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              disabled={!form.location}
            >
              <option value="">
                {form.location ? "— Choose an available vehicle —" : "— Select a location first —"}
              </option>
              {locationFilteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} · {v.brand} {v.model} ({v.color})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedVehicle && (
          <div className="portal-info-box fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} color="var(--primary)" />
              <span>
                Default Assigned Driver:{" "}
                <b style={{ color: "#1a202c" }}>
                  {selectedVehicle.assignedDriverName || "Will be assigned on dispatch"}
                </b>
              </span>
            </div>
            <div style={{ marginTop: "4px", fontSize: "11.5px", color: "var(--text-muted)" }}>
              Admin reviewers may designate a substitute driver if the default driver is unavailable on your travel date.
            </div>
          </div>
        )}

        {selectedVehicle && (
          <VehicleBookingCalendar
            availability={vehicleAvailability}
            focusDate={form.travelDate}
            focusDateEnd={form.travelDateEnd}
          />
        )}

        <div className="portal-field-group">
          <label className="portal-field-label">
            <MapPin size={14} />
            <span>Destination <span style={{ color: "var(--danger)" }}>*</span></span>
          </label>
          <div className="portal-input-wrapper">
            <MapPin size={17} className="portal-input-icon" />
            <input
              required
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="e.g. Provincial Capitol, Calapan City"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="portal-field-group">
            <label className="portal-field-label">
              <CalendarDays size={14} />
              <span>Travel Date (From) <span style={{ color: "var(--danger)" }}>*</span></span>
            </label>
            <div className="portal-input-wrapper">
              <input
                required
                type="date"
                value={form.travelDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    travelDate: e.target.value,
                    travelDateEnd:
                      form.travelDateEnd && form.travelDateEnd < e.target.value ? "" : form.travelDateEnd,
                  })
                }
              />
            </div>
          </div>

          <div className="portal-field-group">
            <label className="portal-field-label">
              <CalendarDays size={14} />
              <span>Travel Date (To, optional)</span>
            </label>
            <div className="portal-input-wrapper">
              <input
                type="date"
                value={form.travelDateEnd}
                min={form.travelDate || undefined}
                onChange={(e) => setForm({ ...form, travelDateEnd: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <FileText size={14} />
            <span>Official Purpose <span style={{ color: "var(--danger)" }}>*</span></span>
          </label>
          <div className="portal-input-wrapper">
            <FileText size={17} className="portal-input-icon" style={{ top: "14px" }} />
            <textarea
              required
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Describe the official reason or event for this travel request..."
            />
          </div>
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <Users size={14} />
            <span>Additional Passengers (Optional)</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {form.passengers.map((name, i) => (
              <div key={i} style={{ display: "flex", gap: "8px" }}>
                <div className="portal-input-wrapper" style={{ flex: 1 }}>
                  <User size={16} className="portal-input-icon" />
                  <input
                    value={name}
                    onChange={(e) => {
                      const next = [...form.passengers];
                      next[i] = e.target.value;
                      setForm({ ...form, passengers: next });
                    }}
                    placeholder={`Passenger ${i + 1} full name`}
                  />
                </div>
                {form.passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, passengers: form.passengers.filter((_, j) => j !== i) })}
                    aria-label="Remove passenger"
                    style={{
                      flexShrink: 0,
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid rgba(245, 101, 101, 0.4)",
                      background: "rgba(180, 40, 40, 0.25)",
                      color: "#fc8181",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, passengers: [...form.passengers, ""] })}
            style={{
              marginTop: "4px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12.5px",
              fontWeight: 700,
              color: "white",
              background: "none",
              border: "none",
              cursor: "pointer",
              alignSelf: "flex-start",
              padding: "4px 0",
            }}
          >
            <Plus size={14} /> Add another passenger
          </button>
        </div>

        <div className="portal-field-group">
          <label className="portal-field-label">
            <CalendarDays size={14} />
            <span>Previous Trip Ticket Date (Optional)</span>
          </label>
          <div className="portal-input-wrapper">
            <input
              type="date"
              value={form.previousTripTicketDate}
              onChange={(e) => setForm({ ...form, previousTripTicketDate: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="portal-submit-btn"
          style={{ marginTop: "6px" }}
        >
          {submitting ? (
            <>
              <Loader2 size={17} className="spin" />
              <span>Submitting Request…</span>
            </>
          ) : (
            <>
              <span>Submit Vehicle Request</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </PageShell>
  );
}

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { branding } = useBranding();

  return (
    <div className="portal-container">
      <div className="login-bg-glow" aria-hidden="true" />

      <main className="portal-wrapper fade-in">
        <nav className="portal-top-nav">
          <Link to="/check-status" className="portal-back-link">
            <Search size={14} />
            <span>Check Request Status</span>
          </Link>
          <div className="portal-nav-badge">
            <Truck size={12} />
            <span>Public Request Form</span>
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
              <Truck size={24} />
            )}
          </div>
          <h1 className="portal-title">Official Vehicle Request</h1>
          <p className="portal-subtitle">
            Complete the form below to request government vehicle transport for official travel.
            A unique tracking code will be generated upon submission.
          </p>
        </header>

        {children}

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

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function VehicleBookingCalendar({
  availability,
  focusDate,
  focusDateEnd,
}: {
  availability: VehicleAvailability[];
  focusDate?: string;
  focusDateEnd?: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!focusDate) return;
    const [y, m] = focusDate.split("-").map(Number);
    if (!y || !m) return;
    setViewYear(y);
    setViewMonth(m - 1);
  }, [focusDate]);

  const bookedDays = React.useMemo(() => {
    const map = new Map<string, "approved" | "pending">();
    for (const req of availability) {
      const start = new Date(req.travelDate + "T00:00:00");
      const end = req.travelDateEnd ? new Date(req.travelDateEnd + "T00:00:00") : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toLocalDateKey(d);
        if (req.status === "approved" || map.get(key) !== "approved") {
          map.set(key, req.status);
        }
      }
    }
    return map;
  }, [availability]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function changeMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const hasAnyBookings = bookedDays.size > 0;

  const selectedDays = React.useMemo(() => {
    const set = new Set<string>();
    if (!focusDate) return set;
    const start = new Date(focusDate + "T00:00:00");
    const end = focusDateEnd ? new Date(focusDateEnd + "T00:00:00") : start;
    if (end < start) return set;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(toLocalDateKey(d));
    }
    return set;
  }, [focusDate, focusDateEnd]);

  const conflict = React.useMemo(() => {
    let worst: "approved" | "pending" | null = null;
    for (const key of selectedDays) {
      const status = bookedDays.get(key);
      if (status === "approved") return "approved" as const;
      if (status === "pending") worst = "pending";
    }
    return worst;
  }, [selectedDays, bookedDays]);

  return (
    <div
      style={{
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "12px",
        padding: "12px",
        background: "rgba(0, 0, 0, 0.22)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            color: "#ffffff",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff" }}>{monthLabel}</span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            color: "#ffffff",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", textAlign: "center" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255, 255, 255, 0.5)", padding: "2px 0" }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const status = bookedDays.get(key);
          const isSelected = selectedDays.has(key);
          const bg = status === "approved" ? "#2f855a" : status === "pending" ? "#dd6b20" : "transparent";
          const color = status || isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.8)";
          return (
            <div
              key={i}
              title={status ? (status === "approved" ? "Approved trip" : "Pending request") : undefined}
              style={{
                fontSize: "11px",
                padding: "4px 0",
                borderRadius: "5px",
                background: bg,
                color,
                fontWeight: status || isSelected ? 800 : 500,
                boxShadow: isSelected ? "inset 0 0 0 1.5px #72ebb0" : "none",
              }}
            >
              {day}
            </div>
          );
        })}
      </div>

      {conflict && (
        <div
          className="fade-in"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "7px",
            marginTop: "10px",
            background: conflict === "approved" ? "rgba(180, 40, 40, 0.35)" : "rgba(180, 100, 20, 0.35)",
            color: conflict === "approved" ? "#fed7d7" : "#feebc8",
            border: `1px solid ${conflict === "approved" ? "rgba(245, 101, 101, 0.5)" : "rgba(237, 137, 54, 0.5)"}`,
            borderRadius: "8px",
            padding: "8px 10px",
            fontSize: "11.5px",
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>
            {conflict === "approved"
              ? "This vehicle has an APPROVED trip on selected date(s)."
              : "This vehicle has a PENDING request on selected date(s)."}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "10.5px", color: "rgba(255, 255, 255, 0.6)", fontWeight: 600 }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#2f855a", display: "inline-block" }} />
          Approved Trip
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#dd6b20", display: "inline-block" }} />
          Pending Request
        </span>
      </div>
    </div>
  );
}
