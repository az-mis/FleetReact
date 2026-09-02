import React, { useEffect, useMemo, useRef, useState, FormEvent } from "react";
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
import { useDriveConfig } from "../contexts/DriveConfigContext";
import { AppUser, UserRole, USER_ROLE_LABEL, USER_ROLE_COLOR } from "../types";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { Plus, Pencil, Trash2, ShieldCheck, List, LayoutGrid, Mail, Crown } from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive } from "../lib/googleDrive";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "admin" as UserRole,
  photoURL: null as string | null,
  photoDriveFileId: null as string | null,
};

export default function Admins() {
  const { currentUser } = useAuth();
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">(
    () => (localStorage.getItem("admins-view") as "list" | "grid") || "list"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();
  const { config: driveConfig } = useDriveConfig();

  // Photo selection is local-only until "Save Changes" is clicked — see the
  // matching comment in Drivers.tsx for the full rationale.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const originalPhotoRef = useRef<{ url: string | null; fileId: string | null }>({ url: null, fileId: null });

  function revokePreview() {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }
  }

  function resetPhotoState() {
    revokePreview();
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPhotoError("");
  }

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

  function setViewMode(mode: "list" | "grid") {
    setView(mode);
    localStorage.setItem("admins-view", mode);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    resetPhotoState();
    originalPhotoRef.current = { url: null, fileId: null };
    setModalOpen(true);
  }

  function openEdit(a: AppUser) {
    setEditing(a);
    setForm({
      name: a.name,
      email: a.email,
      password: "",
      role: a.role,
      photoURL: a.photoURL || null,
      photoDriveFileId: a.photoDriveFileId || null,
    });
    setError("");
    resetPhotoState();
    originalPhotoRef.current = { url: a.photoURL || null, fileId: a.photoDriveFileId || null };
    setModalOpen(true);
  }

  function closeModal() {
    resetPhotoState();
    setModalOpen(false);
  }

  /** Just stages the file for preview — nothing is uploaded to Drive until
   *  Save Changes is clicked (see handleSubmit). */
  function handlePhotoSelect(file: File) {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError("Image is too large. Please choose one under 5MB.");
      return;
    }
    revokePreview();
    const preview = URL.createObjectURL(file);
    photoPreviewUrlRef.current = preview;
    setPhotoFile(file);
    setPhotoRemoved(false);
    setForm((f) => ({ ...f, photoURL: preview }));
  }

  function handlePhotoRemove() {
    revokePreview();
    setPhotoFile(null);
    setPhotoRemoved(true);
    setPhotoError("");
    setForm((f) => ({ ...f, photoURL: null, photoDriveFileId: null }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Resolve the photo now: upload a newly-picked file (or process a
      // removal) to Drive right before saving, instead of at selection time.
      let finalPhotoURL = originalPhotoRef.current.url;
      let finalPhotoDriveFileId = originalPhotoRef.current.fileId;

      if (photoFile) {
        if (!driveConfig) {
          throw new Error("Google Drive isn't connected yet. Ask a super admin to connect it in Content Settings.");
        }
        setPhotoUploading(true);
        try {
          const blob = await compressImageToBlob(photoFile);
          const { fileId, url } = await uploadPhotoToDrive(
            blob,
            `admin-${form.name || form.email || "photo"}-${Date.now()}.jpg`,
            driveConfig.adminFolderId,
            driveConfig.connectedByEmail
          );
          if (originalPhotoRef.current.fileId)
            deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig.connectedByEmail); // best-effort
          finalPhotoURL = url;
          finalPhotoDriveFileId = fileId;
        } catch (err: any) {
          throw new Error(err.message || "Couldn't upload that photo.");
        } finally {
          setPhotoUploading(false);
        }
      } else if (photoRemoved) {
        if (originalPhotoRef.current.fileId)
          deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig?.connectedByEmail); // best-effort
        finalPhotoURL = null;
        finalPhotoDriveFileId = null;
      }

      if (editing) {
        await updateDoc(doc(db, "users", editing.id), {
          name: form.name,
          role: form.role,
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
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
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} added as ${USER_ROLE_LABEL[form.role]}.`);
      }
      closeModal();
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
      if (a.photoDriveFileId) deletePhotoFromDrive(a.photoDriveFileId, driveConfig?.connectedByEmail); // best-effort
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
            <ViewToggle view={view} onChange={setViewMode} />
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

      {filtered.length === 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "28px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <ShieldCheck size={22} style={{ marginBottom: 6 }} />
          <div>No admins found.</div>
        </div>
      )}

      {filtered.length > 0 && view === "grid" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          {filtered.map((a) => (
            <div
              key={a.id}
              className="fade-in"
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: a.role === "super_admin" ? "1px solid #cfe8db" : "1px solid var(--border)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Avatar name={a.name} photoURL={a.photoURL} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name} {a.id === currentUser?.uid && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(you)</span>}
                  </div>
                  <RoleBadge role={a.role} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                <Mail size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => openEdit(a)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "7px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--info)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "7px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--danger)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && view === "list" && (
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "auto",
        }}
      >
        <table style={{ fontSize: "13px", width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "linear-gradient(180deg, #f7fafc, #f1f5f4)", textAlign: "left" }}>
              {["Name", "Email", "Role", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 14px",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "11.5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="admin-row"
                style={{
                  borderTop: "1px solid var(--border)",
                  background: a.id === currentUser?.uid ? "#f6fbf8" : undefined,
                }}
              >
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Avatar name={a.name} photoURL={a.photoURL} size={32} />
                    <span>
                      {a.name} {a.id === currentUser?.uid && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(you)</span>}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>{a.email}</td>
                <td style={{ padding: "12px 14px" }}>
                  <RoleBadge role={a.role} />
                </td>
                <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => openEdit(a)}
                    className="admin-icon-btn"
                    style={{ background: "none", border: "none", color: "var(--info)", padding: "6px", borderRadius: "7px", cursor: "pointer" }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="admin-icon-btn"
                    style={{ background: "none", border: "none", color: "var(--danger)", padding: "6px", borderRadius: "7px", cursor: "pointer" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {modalOpen && (
        <Modal title={editing ? "Edit Admin" : "Add Admin"} onClose={closeModal}>
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
              onRemove={handlePhotoRemove}
              error={photoError}
              label={photoUploading ? "Uploading to Drive…" : "Photo (optional, max 5MB)"}
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
              disabled={saving || photoUploading}
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
              {photoUploading ? "Uploading photo..." : saving ? "Saving..." : editing ? "Save Changes" : "Add Admin"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const isSuper = role === "super_admin";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: USER_ROLE_COLOR[role] + "1a",
        color: USER_ROLE_COLOR[role],
        border: isSuper ? `1px solid ${USER_ROLE_COLOR[role]}40` : "none",
        padding: isSuper ? "3px 10px 3px 8px" : "3px 9px",
        borderRadius: "999px",
        fontSize: "11.5px",
        fontWeight: 700,
      }}
    >
      {isSuper && <Crown size={11} />}
      {USER_ROLE_LABEL[role]}
    </span>
  );
}

function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  const btn = (mode: "list" | "grid", Icon: any, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      aria-label={label}
      aria-pressed={view === mode}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "7px",
        border: "none",
        background: view === mode ? "#fff" : "transparent",
        color: view === mode ? "var(--primary)" : "rgba(255,255,255,0.85)",
        cursor: "pointer",
      }}
    >
      <Icon size={15} />
    </button>
  );
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        padding: "2px",
        borderRadius: "9px",
        background: "rgba(255,255,255,0.16)",
      }}
    >
      {btn("list", List, "List view")}
      {btn("grid", LayoutGrid, "Grid view")}
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
