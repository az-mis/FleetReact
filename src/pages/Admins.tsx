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
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { Plus, Pencil, Trash2, ShieldCheck, List, LayoutGrid, Mail, Crown } from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Pagination from "../components/Pagination";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";
import LocationFilter from "../components/LocationFilter";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

export const LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
];

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "admin" as UserRole,
  location: "",
  phoneNumber: "",
  signee1Name: "",
  signee1Title: "",
  signee2Name: "",
  signee2Title: "",
  photoURL: null as string | null,
  photoDriveFileId: null as string | null,
};

export default function Admins() {
  const { currentUser } = useAuth();
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "grid">(
    () => (localStorage.getItem("admins-view") as "list" | "grid") || "list"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showSuccess, showError } = useToast();
  const { config: driveConfig } = useDriveConfig();

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
    let list = selectedLocation
      ? admins.filter((a) => a.location === selectedLocation)
      : admins;
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((a) => [a.name, a.email, a.location].some((f) => (f || "").toLowerCase().includes(s)));
    }
    return list;
  }, [admins, search, selectedLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocation]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

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
      location: a.location || "",
      phoneNumber: a.phoneNumber || "",
      signee1Name: a.signee1Name || "",
      signee1Title: a.signee1Title || "",
      signee2Name: a.signee2Name || "",
      signee2Title: a.signee2Title || "",
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

  function handleBeforePhotoPick() {
    if (driveConfig) preauthorizeDrive(driveConfig.connectedByEmail);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!editing && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!form.phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (editing) {
      setConfirmSaveOpen(true);
    } else {
      executeSave();
    }
  }

  async function executeSave() {
    setConfirmSaveOpen(false);
    setSaving(true);
    try {
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
            deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig.connectedByEmail);
          finalPhotoURL = url;
          finalPhotoDriveFileId = fileId;
        } catch (err: any) {
          throw new Error(err.message || "Couldn't upload that photo.");
        } finally {
          setPhotoUploading(false);
        }
      } else if (photoRemoved) {
        if (originalPhotoRef.current.fileId)
          deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig?.connectedByEmail);
        finalPhotoURL = null;
        finalPhotoDriveFileId = null;
      }

      if (editing) {
        await updateDoc(doc(db, "users", editing.id), {
          name: form.name,
          role: form.role,
          location: form.role === "admin" ? (form.location || null) : null,
          phoneNumber: form.phoneNumber || null,
          signee1Name: form.signee1Name || null,
          signee1Title: form.signee1Title || null,
          signee2Name: form.signee2Name || null,
          signee2Title: form.signee2Title || null,
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} updated.`);
      } else {
        const uid = await createUserWithoutSignIn(form.email, form.password);
        await setDoc(doc(db, "users", uid), {
          name: form.name,
          email: form.email,
          role: form.role,
          location: form.role === "admin" ? (form.location || null) : null,
          phoneNumber: form.phoneNumber || null,
          signee1Name: form.signee1Name || null,
          signee1Title: form.signee1Title || null,
          signee2Name: form.signee2Name || null,
          signee2Title: form.signee2Title || null,
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

  function handleDelete(a: AppUser) {
    if (a.id === currentUser?.uid) {
      showError("You can't delete your own account while signed in.");
      return;
    }
    setDeleteTarget(a);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const a = deleteTarget;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", a.id));
      if (a.photoDriveFileId) deletePhotoFromDrive(a.photoDriveFileId, driveConfig?.connectedByEmail); // best-effort
      showSuccess(`${a.name} deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showError(err.message || `Couldn't delete ${a.name}.`);
    } finally {
      setDeleting(false);
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
            <LocationFilter
              value={selectedLocation}
              onChange={setSelectedLocation}
            />
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
          {paginated.map((a) => (
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
              {a.role === "admin" && (
                <div style={{ fontSize: "11.5px", color: "#4a5568", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>📍</span>
                  <span style={{ fontWeight: 600 }}>{a.location || "All Locations"}</span>
                </div>
              )}
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
              {["Name", "Email", "Role", "Assigned Location", ""].map((h) => (
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
            {paginated.map((a) => (
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
                <td style={{ padding: "12px 14px", color: "#2d3748", fontSize: "12.5px" }}>
                  {a.role === "super_admin" ? (
                    <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "12px" }}>All (Super Admin)</span>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{a.location || "All Locations"}</span>
                  )}
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

      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="admins"
        />
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
              onBeforePick={handleBeforePhotoPick}
              onRemove={handlePhotoRemove}
              error={photoError}
              label={photoUploading ? "Uploading to Drive…" : "Photo (optional, max 5MB)"}
            />

            <Field label="Full Name" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter Full Name" style={inputStyle} />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                required
                disabled={!!editing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email"
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
                  placeholder="Set temporary password"
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

            {form.role === "admin" && (
              <Field label="Assigned Location / Office Province">
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">— All Locations (No restriction) —</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Admins assigned to a specific province will only see vehicle requests from that location.
                </small>
              </Field>
            )}

            <Field label="Phone Number" required>
              <input
                type="tel"
                required
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="e.g. 09171234567"
                style={inputStyle}
              />
            </Field>

            {/* Trip Ticket Signatories — hidden for Super Admin */}
            {form.role !== "super_admin" && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#1a202c", marginBottom: "8px" }}>
                  Trip Ticket Signatories (Approved by)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                  <Field label="Signatory 1 Name">
                    <input
                      placeholder="e.g. ARJAY D. BURGOS"
                      value={form.signee1Name}
                      onChange={(e) => setForm({ ...form, signee1Name: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Signatory 1 Title / Office">
                    <input
                      placeholder="e.g. OIC - APCO-Oriental Mindoro"
                      value={form.signee1Title}
                      onChange={(e) => setForm({ ...form, signee1Title: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Field label="Signatory 2 Name">
                    <input
                      placeholder="e.g. EDGARDO F. LEIDO, Jr."
                      value={form.signee2Name}
                      onChange={(e) => setForm({ ...form, signee2Name: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Signatory 2 Title / Office">
                    <input
                      placeholder="e.g. GSS Regional Office Calapan City"
                      value={form.signee2Title}
                      onChange={(e) => setForm({ ...form, signee2Title: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || photoUploading}
              style={{
                marginTop: "6px",
                height: "38px",
                borderRadius: "9px",
                border: "none",
                background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: saving || photoUploading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(0, 168, 107, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              {photoUploading ? "Uploading photo..." : saving ? "Saving..." : editing ? "Save Changes" : "Add Admin"}
            </button>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog before updating admin */}
      <ConfirmDialog
        open={confirmSaveOpen}
        title="Confirm Administrator Update?"
        danger={false}
        confirmLabel="Yes, Save Changes"
        confirmingLabel="Saving..."
        message={
          editing && (
            <div>
              Are you sure you want to update administrator <strong>{form.name}</strong>?
              <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                • Role: <strong>{USER_ROLE_LABEL[form.role]}</strong>
                <br />
                • Assigned Location: <strong>{form.role === "admin" ? (form.location || "All Locations") : "All Locations (Super Admin)"}</strong>
              </div>
            </div>
          )
        }
        loading={saving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={executeSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${USER_ROLE_LABEL[deleteTarget.role]}?` : ""}
        message={
          deleteTarget && (
            <>
              Delete <strong>{deleteTarget.name}</strong>? This removes their profile record. This can't be undone.
            </>
          )
        }
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
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
        padding: isSuper ? "2px 8px 2px 6px" : "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
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
        width: 30,
        height: 30,
        borderRadius: "6px",
        border: "none",
        background: view === mode ? "#fff" : "transparent",
        color: view === mode ? "var(--primary)" : "rgba(255,255,255,0.85)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <Icon size={14} />
    </button>
  );
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        padding: "2px",
        borderRadius: "8px",
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
      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4a5568" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0 11px",
  height: "38px",
  borderRadius: "8px",
  border: "1.5px solid var(--border)",
  fontSize: "13px",
  width: "100%",
  outline: "none",
};
