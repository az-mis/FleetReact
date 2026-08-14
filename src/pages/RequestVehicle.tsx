import React, { useEffect, useState, FormEvent } from "react";
import { doc, setDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { Vehicle } from "../types";
import { OFFICES } from "../data/offices";
import SearchableSelect from "../components/SearchableSelect";
import { Truck, CheckCircle2, User, Building2, Phone, MapPin, CalendarDays, FileText, Users, Search, Copy } from "lucide-react";

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

// MIMAROPA region provinces + the Quezon City satellite office — used for the
// "Location / Room / Building" field on the request form. Kept as a plain
// list for now; the plan is to eventually filter available offices by which
// one is picked here, but that mapping doesn't exist yet.
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

export default function RequestVehicle() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("plateNumber"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicleId) || null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

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

    setSubmitting(true);
    try {
      // The reference code IS the document ID (not just a field). That way
      // the status-check page can look up a request with a single-document
      // getDoc() — which Firestore rules can allow publicly without opening
      // up the whole collection to listing/enumeration.
      const code = generateReferenceCode();
      await setDoc(doc(db, "vehicleRequests", code), {
        requesterName: form.requesterName.trim(),
        location: form.location,
        requesterOffice: form.requesterOffice.trim() || null,
        requesterContact: form.requesterContact.trim() || null,
        requesterIsPassenger: form.requesterIsPassenger,
        vehicleId: selectedVehicle!.id,
        vehiclePlateNumber: selectedVehicle!.plateNumber,
        defaultDriverId: selectedVehicle!.assignedDriverId || null,
        defaultDriverName: selectedVehicle!.assignedDriverName || null,
        purpose: form.purpose.trim(),
        destination: form.destination.trim(),
        travelDate: form.travelDate,
        travelDateEnd: form.travelDateEnd || null,
        passengers: form.passengers.map((p) => p.trim()).filter(Boolean).length
          ? form.passengers.map((p) => p.trim()).filter(Boolean)
          : null,
        previousTripTicketDate: form.previousTripTicketDate || null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        <div className="fade-in" style={{ textAlign: "center", padding: "12px 4px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#e6f7ee",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle2 size={30} />
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a202c", marginBottom: "6px" }}>
            Request submitted
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "18px" }}>
            Your vehicle request has been sent for approval. Save your reference code below to
            check whether it's been approved or declined.
          </p>

          <div
            style={{
              background: "#f7fafc",
              border: "1px dashed var(--border)",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              YOUR REFERENCE CODE
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "3px", color: "#1a202c" }}>
                {referenceCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(referenceCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                title="Copy code"
                style={{
                  border: "1px solid var(--border)",
                  background: "#fff",
                  borderRadius: "6px",
                  padding: "6px",
                  display: "flex",
                  cursor: "pointer",
                }}
              >
                <Copy size={14} />
              </button>
            </div>
            {copied && (
              <div style={{ fontSize: "11px", color: "var(--primary)", marginTop: "6px" }}>Copied!</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link
              to={`/check-status?code=${referenceCode}`}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "13.5px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Search size={14} /> Check status now
            </Link>
            <button
              onClick={() => {
                setForm(emptyForm);
                setSubmitted(false);
              }}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "#fff",
                color: "#2d3748",
                fontWeight: 600,
                fontSize: "13.5px",
              }}
            >
              Submit another request
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && (
          <div style={{ background: "#fff5f5", color: "var(--danger)", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <Field label="Your Name" icon={User} required>
          <input
            required
            value={form.requesterName}
            onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
            style={inputStyle}
            placeholder="Input your name"
          />
        </Field>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12.5px",
            color: "#374151",
            marginTop: "-6px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.requesterIsPassenger}
            onChange={(e) => setForm({ ...form, requesterIsPassenger: e.target.checked })}
            style={{ width: "15px", height: "15px", cursor: "pointer" }}
          />
          I'm also riding along on this trip (not just requesting it)
        </label>

        <Field label="Location / Room / Building" icon={MapPin} required>
          <select
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={inputStyle}
          >
            <option value="">— Select Location —</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Office / Section" icon={Building2}>
          <SearchableSelect
            value={form.requesterOffice}
            options={OFFICES.map((o) => ({ value: o.label, label: o.label }))}
            onChange={(v) => setForm({ ...form, requesterOffice: v })}
            placeholder="— Select your office —"
            searchPlaceholder="Search office..."
          />
        </Field>

        <Field label="Contact No." icon={Phone}>
          <input
            value={form.requesterContact}
            onChange={(e) => setForm({ ...form, requesterContact: e.target.value })}
            style={inputStyle}
            placeholder="09XX-XXX-XXXX"
          />
        </Field>

        <Field label="Vehicle Needed" icon={Truck} required>
          <select
            required
            value={form.vehicleId}
            onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
            style={inputStyle}
          >
            <option value="">— Select a vehicle —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} · {v.brand} {v.model}
              </option>
            ))}
          </select>
        </Field>

        {selectedVehicle && (
          <div
            style={{
              background: "#f7fafc",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12.5px",
              color: "var(--text-muted)",
            }}
          >
            Default driver:{" "}
            <b style={{ color: "#2d3748" }}>{selectedVehicle.assignedDriverName || "Not yet assigned"}</b>
            <div style={{ marginTop: "2px" }}>
              This will be confirmed by an admin — they may assign a substitute driver if this
              one is unavailable.
            </div>
          </div>
        )}

        <Field label="Destination" icon={MapPin} required>
          <input
            required
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            style={inputStyle}
            placeholder="Input your destination"
          />
        </Field>

        <div className="rv-date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Field label="Travel Date (From)" icon={CalendarDays} required>
            <input
              required
              type="date"
              value={form.travelDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  travelDate: e.target.value,
                  // Keep "To" from silently pre-dating a newly picked "From"
                  travelDateEnd:
                    form.travelDateEnd && form.travelDateEnd < e.target.value ? "" : form.travelDateEnd,
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Travel Date (To, optional)" icon={CalendarDays}>
            <input
              type="date"
              value={form.travelDateEnd}
              min={form.travelDate || undefined}
              onChange={(e) => setForm({ ...form, travelDateEnd: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "-8px" }}>
          Leave "To" blank for a same-day trip. Fill it in only if travel spans more than one day.
        </p>

        <Field label="Purpose" icon={FileText} required>
          <textarea
            required
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
            placeholder="What is this trip for?"
          />
        </Field>

        <Field label="Passengers (optional)" icon={Users}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {form.passengers.map((name, i) => (
              <div key={i} style={{ display: "flex", gap: "8px" }}>
                <input
                  value={name}
                  onChange={(e) => {
                    const next = [...form.passengers];
                    next[i] = e.target.value;
                    setForm({ ...form, passengers: next });
                  }}
                  style={inputStyle}
                  placeholder={`Passenger ${i + 1} name`}
                />
                {form.passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, passengers: form.passengers.filter((_, j) => j !== i) })}
                    aria-label="Remove passenger"
                    style={{
                      flexShrink: 0,
                      width: "38px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "#fff",
                      color: "var(--text-muted)",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, passengers: [...form.passengers, ""] })}
            style={{
              marginTop: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            + Add another passenger
          </button>
        </Field>

        <Field label="Previous Trip Ticket Date (optional)" icon={CalendarDays}>
          <input
            type="date"
            value={form.previousTripTicketDate}
            onChange={(e) => setForm({ ...form, previousTripTicketDate: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "-8px" }}>
          If you've used a Driver's Trip Ticket before, enter its date here. Leave blank if this
          is your first request.
        </p>

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: "6px",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "14.5px",
          }}
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
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
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <style>{`
          @media (max-width: 380px) {
            .rv-date-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", color: "#fff" }}>
          <Truck size={22} />
          <h1 style={{ fontSize: "19px", fontWeight: 700 }}>Vehicle Request</h1>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "6px" }}>
          Fill this out to request a government vehicle for official travel.
        </p>
        <p style={{ fontSize: "12.5px", marginBottom: "20px" }}>
          <Link to="/check-status" style={{ color: "#fff", textDecoration: "underline" }}>
            Already submitted a request? Check its status →
          </Link>
        </p>
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon: any;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    // A plain <div>, not <label> — this wrapper has no htmlFor, so it isn't a real
    // accessible label anyway, and a <label> here causes a real bug: clicking a
    // non-form-control element inside it (like an option row in a custom dropdown)
    // makes the browser forward a synthetic click to the field's control, which
    // re-toggles dropdowns like SearchableSelect right after they close.
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#374151",
        }}
      >
        <Icon size={13} />
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  width: "100%",
  fontFamily: "inherit",
};
