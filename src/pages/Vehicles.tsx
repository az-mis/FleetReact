import React, { useEffect, useMemo, useState, FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Vehicle } from "../types";
import Modal from "../components/Modal";
import { Plus, Pencil, Trash2, Search, Truck } from "lucide-react";

const emptyForm = {
  plateNumber: "",
  chassisNumber: "",
  engineNumber: "",
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  color: "",
  odometer: 0,
  vehicleType: "",
  fuelType: "",
};

export default function Vehicles() {
  const { isSuperAdmin } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter((v) =>
      [v.plateNumber, v.brand, v.model, v.chassisNumber, v.engineNumber].some((f) =>
        (f || "").toLowerCase().includes(s)
      )
    );
  }, [vehicles, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      plateNumber: v.plateNumber,
      chassisNumber: v.chassisNumber,
      engineNumber: v.engineNumber,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      odometer: v.odometer,
      vehicleType: v.vehicleType || "",
      fuelType: v.fuelType || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^[A-Za-z0-9\- ]+$/.test(form.plateNumber.trim())) {
      setError("Plate number may only contain letters, numbers, dashes, and spaces.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        plateNumber: form.plateNumber.trim(),
        year: Number(form.year),
        odometer: Number(form.odometer),
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        // Mirrors the Laravel rule: only a Super Admin may change the plate
        // number on an existing vehicle. Admins editing a vehicle keep the
        // original plate number regardless of what's in the form.
        if (!isSuperAdmin) {
          payload.plateNumber = editing.plateNumber;
        }
        await updateDoc(doc(db, "vehicles", editing.id), payload);
      } else {
        await addDoc(collection(db, "vehicles"), { ...payload, createdAt: serverTimestamp() });
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: Vehicle) {
    if (!confirm(`Delete vehicle ${v.plateNumber}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "vehicles", v.id));
  }

  return (
    <div className="fade-in">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "18px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Vehicles</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{vehicles.length} registered</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 9, color: "var(--text-muted)" }} />
            <input
              placeholder="Search plate, brand, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 10px 8px 32px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "13px",
                width: "220px",
              }}
            />
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> Register Vehicle
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "auto" }}>
        <table style={{ fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              {["Plate #", "Brand / Model", "Year", "Color", "Odometer", "Type", "Fuel", ""].map((h) => (
                <th key={h} style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Truck size={22} style={{ marginBottom: 6 }} />
                  <div>No vehicles found.</div>
                </td>
              </tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{v.plateNumber}</td>
                <td style={{ padding: "10px 14px" }}>
                  {v.brand} {v.model}
                </td>
                <td style={{ padding: "10px 14px" }}>{v.year}</td>
                <td style={{ padding: "10px 14px" }}>{v.color}</td>
                <td style={{ padding: "10px 14px" }}>{v.odometer.toLocaleString()} km</td>
                <td style={{ padding: "10px 14px" }}>{v.vehicleType || "—"}</td>
                <td style={{ padding: "10px 14px" }}>{v.fuelType || "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => openEdit(v)}
                    style={{ background: "none", border: "none", color: "var(--info)", padding: "4px" }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    style={{ background: "none", border: "none", color: "var(--danger)", padding: "4px" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editing ? "Edit Vehicle" : "Register Vehicle"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && (
              <div style={{ background: "#fff5f5", color: "var(--danger)", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <Field label="Plate Number" required>
              <input
                required
                value={form.plateNumber}
                disabled={!!editing && !isSuperAdmin}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                style={inputStyle}
              />
              {editing && !isSuperAdmin && (
                <small style={{ color: "var(--text-muted)" }}>Only a Super Admin can change the plate number.</small>
              )}
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Brand" required>
                <input required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Model" required>
                <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Chassis Number" required>
                <input
                  required
                  value={form.chassisNumber}
                  onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Engine Number" required>
                <input
                  required
                  value={form.engineNumber}
                  onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <Field label="Year" required>
                <input
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Color" required>
                <input required value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Odometer (km)" required>
                <input
                  type="number"
                  required
                  min={0}
                  value={form.odometer}
                  onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Vehicle Type">
                <input value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Fuel Type">
                <input value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: "8px",
                padding: "11px",
                borderRadius: "8px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Register Vehicle"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  width: "100%",
};
