import React, { useEffect, useState, FormEvent } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Vehicle } from "../types";
import { Truck, CheckCircle2, User, Building2, Phone, MapPin, CalendarDays, FileText, Users } from "lucide-react";

const emptyForm = {
  requesterName: "",
  requesterOffice: "",
  requesterContact: "",
  vehicleId: "",
  purpose: "",
  destination: "",
  travelDate: "",
  passengers: "",
};

export default function RequestVehicle() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

    if (!form.vehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "vehicleRequests"), {
        requesterName: form.requesterName.trim(),
        requesterOffice: form.requesterOffice.trim() || null,
        requesterContact: form.requesterContact.trim() || null,
        vehicleId: selectedVehicle!.id,
        vehiclePlateNumber: selectedVehicle!.plateNumber,
        defaultDriverId: selectedVehicle!.assignedDriverId || null,
        defaultDriverName: selectedVehicle!.assignedDriverName || null,
        purpose: form.purpose.trim(),
        destination: form.destination.trim(),
        travelDate: form.travelDate,
        passengers: form.passengers.trim() || null,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "20px" }}>
            Your vehicle request has been sent for approval. An admin will confirm the vehicle and
            driver — please check with your office for confirmation before your travel date.
          </p>
          <button
            onClick={() => {
              setForm(emptyForm);
              setSubmitted(false);
            }}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "13.5px",
            }}
          >
            Submit another request
          </button>
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
            placeholder="Juan Dela Cruz"
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Field label="Office / Section" icon={Building2}>
            <input
              value={form.requesterOffice}
              onChange={(e) => setForm({ ...form, requesterOffice: e.target.value })}
              style={inputStyle}
              placeholder="e.g. APCO"
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
        </div>

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
            placeholder="e.g. Pinamalayan and Socorro, Oriental Mindoro"
          />
        </Field>

        <Field label="Date of Travel" icon={CalendarDays} required>
          <input
            required
            type="date"
            value={form.travelDate}
            onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
            style={inputStyle}
          />
        </Field>

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
          <input
            value={form.passengers}
            onChange={(e) => setForm({ ...form, passengers: e.target.value })}
            style={inputStyle}
            placeholder="Names of other passengers, if any"
          />
        </Field>

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
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", color: "#fff" }}>
          <Truck size={22} />
          <h1 style={{ fontSize: "19px", fontWeight: 700 }}>Vehicle Request</h1>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "20px" }}>
          Fill this out to request a government vehicle for official travel.
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
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        <Icon size={13} />
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
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
