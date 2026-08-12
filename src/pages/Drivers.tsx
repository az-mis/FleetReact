import React, { useEffect, useMemo, useState, FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { createUserWithoutSignIn } from "../lib/secondaryAuth";
import { useToast } from "../contexts/ToastContext";
import { AppUser } from "../types";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { Plus, Pencil, Trash2, Users, List, LayoutGrid, Mail, MapPin, BadgeCheck } from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  birthDate: "",
  address: "",
  licenseExpirationDate: "",
};

export default function Drivers() {
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("drivers:view") as "list" | "grid") || "list";
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "driver"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    localStorage.setItem("drivers:view", view);
  }, [view]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter((d) => [d.name, d.email].some((f) => (f || "").toLowerCase().includes(s)));
  }, [drivers, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(d: AppUser) {
    setEditing(d);
    setForm({
      name: d.name,
      email: d.email,
      password: "",
      birthDate: d.birthDate || "",
      address: d.address || "",
      licenseExpirationDate: d.licenseExpirationDate || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "users", editing.id), {
          name: form.name,
          birthDate: form.birthDate || null,
          address: form.address || null,
          licenseExpirationDate: form.licenseExpirationDate || null,
          updatedAt: serverTimestamp(),
        });
        // vehicles.assignedDriverName is a denormalized copy of the driver's
        // name (set once in Vehicle Assigning), so it doesn't update on its
        // own when the driver is renamed here. Cascade the new name to any
        // vehicle(s) currently assigned to this driver so Vehicle Requests /
        // the public request form don't keep showing the old name.
        if (form.name !== editing.name) {
          const assignedVehicles = await getDocs(
            query(collection(db, "vehicles"), where("assignedDriverId", "==", editing.id))
          );
          if (!assignedVehicles.empty) {
            const batch = writeBatch(db);
            assignedVehicles.docs.forEach((v) => {
              batch.update(v.ref, { assignedDriverName: form.name, updatedAt: serverTimestamp() });
            });
            await batch.commit();
          }
        }
        // Note: email/password changes for an existing Firebase Auth user
        // require the Admin SDK (a backend/Cloud Function) since the client
        // SDK can only change credentials for the currently signed-in user.
      } else {
        if (form.password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        const uid = await createUserWithoutSignIn(form.email, form.password);
        await setDoc(doc(db, "users", uid), {
          name: form.name,
          email: form.email,
          role: "driver",
          birthDate: form.birthDate || null,
          address: form.address || null,
          licenseExpirationDate: form.licenseExpirationDate || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} added as a driver.`);
      }
      if (editing) showSuccess(`${form.name} updated.`);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      showError(err.message || "Something went wrong while saving the driver.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: AppUser) {
    if (!confirm(`Delete driver ${d.name}? This removes their profile record.`)) return;
    // Deleting the matching Firebase Auth account also requires the Admin
    // SDK; wire this up to a Cloud Function if you need full account removal.
    try {
      await deleteDoc(doc(db, "users", d.id));
      showSuccess(`${d.name} deleted.`);
    } catch (err: any) {
      showError(err.message || `Couldn't delete ${d.name}.`);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={Users}
        title="Drivers"
        subtitle={`${drivers.length} on record`}
        actions={
          <>
            <div className="header-search-wrap">
              <HeaderSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name or email..."
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
              <Plus size={16} /> Add Driver
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
          <Users size={22} style={{ marginBottom: 6 }} />
          <div>No drivers found.</div>
        </div>
      ) : view === "list" ? (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "auto" }}>
          <table style={{ fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f7fafc", textAlign: "left" }}>
                {["Name", "Email", "Address", "License Expiry", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.name}</td>
                  <td style={{ padding: "10px 14px" }}>{d.email}</td>
                  <td style={{ padding: "10px 14px" }}>{d.address || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{d.licenseExpirationDate || "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openEdit(d)}
                      style={{ background: "none", border: "none", color: "var(--info)", padding: "4px" }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
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
          {filtered.map((d) => (
            <DriverCard key={d.id} driver={d} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? "Edit Driver" : "Add Driver"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && (
              <div style={{ background: "#fff5f5", color: "var(--danger)", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <Field label="Full Name" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                required
                disabled={!!editing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
              />
              {editing && <small style={{ color: "var(--text-muted)" }}>Email changes require a backend admin action.</small>}
            </Field>

            {!editing && (
              <Field label="Temporary Password" required>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Birth Date">
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="License Expiration">
                <input
                  type="date"
                  value={form.licenseExpirationDate}
                  onChange={(e) => setForm({ ...form, licenseExpirationDate: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Address">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </Field>

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
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Driver"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DriverCard({
  driver,
  onEdit,
  onDelete,
}: {
  driver: AppUser;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initial = (driver.name || driver.email || "?")[0]?.toUpperCase();

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
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "15px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {driver.name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Driver</div>
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
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mail size={13} style={{ flexShrink: 0 }} /> {driver.email}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MapPin size={13} style={{ flexShrink: 0 }} /> {driver.address || "No address on file"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BadgeCheck size={13} style={{ flexShrink: 0 }} />
          {driver.licenseExpirationDate ? `License exp: ${driver.licenseExpirationDate}` : "No license expiry on file"}
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
