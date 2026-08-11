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
import PageHeader from "../components/PageHeader";
import { Plus, Pencil, Trash2, Search, Truck, List, LayoutGrid, Gauge, Palette, Fuel } from "lucide-react";

const emptyForm = {
  plateNumber: "",
  chassisNumber: "",
  engineNumber: "",
  brand: "",
  model: "",
  year: "" as number | "",
  color: "",
  odometer: 0,
  vehicleType: "",
  fuelType: "",
};

export default function Vehicles() {
  const { isSuperAdmin } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("vehicles:view") as "list" | "grid") || "list";
  });
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

  useEffect(() => {
    localStorage.setItem("vehicles:view", view);
  }, [view]);

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

    if (form.year === "" || Number(form.year) < 1900 || Number(form.year) > new Date().getFullYear() + 1) {
      setError("Please enter a valid year.");
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
      <PageHeader
        icon={Truck}
        title="Vehicles"
        subtitle={`${vehicles.length} registered`}
        actions={
          <>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 9, color: "var(--text-muted)" }} />
              <input
                placeholder="Search plate, brand, model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "8px 10px 8px 32px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "13px",
                  width: "220px",
                  background: "rgba(255,255,255,0.92)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "8px",
                padding: "3px",
                background: "rgba(255,255,255,0.16)",
                gap: "2px",
              }}
            >
              <button
                onClick={() => setView("list")}
                title="List view"
                aria-pressed={view === "list"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: view === "list" ? "#fff" : "transparent",
                  color: view === "list" ? "var(--primary)" : "#fff",
                  boxShadow: view === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                <List size={15} /> List
              </button>
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                aria-pressed={view === "grid"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: view === "grid" ? "#fff" : "transparent",
                  color: view === "grid" ? "var(--primary)" : "#fff",
                  boxShadow: view === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                <LayoutGrid size={15} /> Grid
              </button>
            </div>
            <button
              onClick={openCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#fff",
                color: "var(--primary)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <Plus size={16} /> Register Vehicle
            </button>
          </>
        }
      />

      {filtered.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <Truck size={22} style={{ marginBottom: 6 }} />
          <div>No vehicles found.</div>
        </div>
      ) : view === "list" ? (
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
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "14px",
          }}
        >
          {filtered.map((v) => (
            <VehicleCard key={v.id} vehicle={v} onEdit={() => openEdit(v)} onDelete={() => handleDelete(v)} />
          ))}
        </div>
      )}

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
                  placeholder={String(new Date().getFullYear())}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value === "" ? "" : Number(e.target.value) })}
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

function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: "var(--accent)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Truck size={19} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vehicle.plateNumber}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vehicle.brand} {vehicle.model} · {vehicle.year}
          </div>
        </div>
        <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{ background: "none", border: "none", color: "var(--info)", padding: "4px" }}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", color: "var(--danger)", padding: "4px" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px", color: "var(--text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Palette size={13} style={{ flexShrink: 0 }} /> {vehicle.color}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Gauge size={13} style={{ flexShrink: 0 }} /> {vehicle.odometer.toLocaleString()} km
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Fuel size={13} style={{ flexShrink: 0 }} />
          {vehicle.vehicleType || "—"}{vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
        </span>
      </div>
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
