import React, { useEffect, useMemo, useState, FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { createUserWithoutSignIn } from "../lib/secondaryAuth";
import { AppUser } from "../types";
import Modal from "../components/Modal";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "driver"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) })));
    });
    return unsub;
  }, []);

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
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: AppUser) {
    if (!confirm(`Delete driver ${d.name}? This removes their profile record.`)) return;
    // Deleting the matching Firebase Auth account also requires the Admin
    // SDK; wire this up to a Cloud Function if you need full account removal.
    await deleteDoc(doc(db, "users", d.id));
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
          <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Drivers</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{drivers.length} on record</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 9, color: "var(--text-muted)" }} />
            <input
              placeholder="Search name or email..."
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
            <Plus size={16} /> Add Driver
          </button>
        </div>
      </div>

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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Users size={22} style={{ marginBottom: 6 }} />
                  <div>No drivers found.</div>
                </td>
              </tr>
            )}
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
