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
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppUser, UserRole, USER_ROLE_LABEL, USER_ROLE_COLOR } from "../types";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";
import { compressImageToDataURL } from "../lib/imageCompress";

const emptyForm = { name: "", email: "", password: "", role: "admin" as UserRole, photoURL: null as string | null };

export default function Admins() {
  const { currentUser } = useAuth();
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "in", ["admin", "super_admin"]), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return admins;
    return admins.filter((a) => [a.name, a.email].some((f) => (f || "").toLowerCase().includes(s)));
  }, [admins, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setPhotoError("");
    setModalOpen(true);
  }

  function openEdit(a: AppUser) {
    setEditing(a);
    setForm({ name: a.name, email: a.email, password: "", role: a.role, photoURL: a.photoURL || null });
    setError("");
    setPhotoError("");
    setModalOpen(true);
  }

  async function handlePhotoSelect(file: File) {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    try {
      const dataUrl = await compressImageToDataURL(file);
      setForm((f) => ({ ...f, photoURL: dataUrl }));
    } catch (err: any) {
      setPhotoError(err.message || "Couldn't process that image.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "users", editing.id), {
          name: form.name,
          role: form.role,
          photoURL: form.photoURL || null,
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} updated.`);
      } else {
        if (form.password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        const uid = await createUserWithoutSignIn(form.email, form.password);
        await setDoc(doc(db, "users", uid), {
          name: form.name,
          email: form.email,
          role: form.role,
          photoURL: form.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} added as ${USER_ROLE_LABEL[form.role]}.`);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      showError(err.message || "Something went wrong while saving the account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: AppUser) {
    if (a.id === currentUser?.uid) {
      alert("You can't delete your own account while signed in.");
      return;
    }
    if (!confirm(`Delete ${USER_ROLE_LABEL[a.role]} ${a.name}? This removes their profile record.`)) return;
    try {
      await deleteDoc(doc(db, "users", a.id));
      showSuccess(`${a.name} deleted.`);
    } catch (err: any) {
      showError(err.message || `Couldn't delete ${a.name}.`);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={ShieldCheck}
        title="Admins"
        subtitle={`${admins.length} accounts • Super Admin only`}
        actions={
          <>
            <div className="header-search-wrap">
              <HeaderSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name or email..."
              />
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
              <Plus size={16} /> Add Admin
            </button>
          </>
        }
      />

      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid var(--border)", overflow: "auto" }}>
        <table style={{ fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              {["Name", "Email", "Role", ""].map((h) => (
                <th key={h} style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>
                  <ShieldCheck size={22} style={{ marginBottom: 6 }} />
                  <div>No admins found.</div>
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Avatar name={a.name} photoURL={a.photoURL} size={30} />
                    <span>
                      {a.name} {a.id === currentUser?.uid && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(you)</span>}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "10px 14px" }}>{a.email}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      background: USER_ROLE_COLOR[a.role] + "1a",
                      color: USER_ROLE_COLOR[a.role],
                      padding: "3px 9px",
                      borderRadius: "999px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                    }}
                  >
                    {USER_ROLE_LABEL[a.role]}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => openEdit(a)}
                    style={{ background: "none", border: "none", color: "var(--info)", padding: "4px" }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
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
        <Modal title={editing ? "Edit Admin" : "Add Admin"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && (
              <div style={{ background: "#fff5f5", color: "var(--danger)", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <AvatarPicker
              inputId="admin-photo-input"
              name={form.name}
              photoURL={form.photoURL}
              onSelect={handlePhotoSelect}
              onRemove={() => setForm((f) => ({ ...f, photoURL: null }))}
              error={photoError}
            />

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

            <Field label="Role" required>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} style={inputStyle}>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
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
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Admin"}
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
