import React, { useEffect, useMemo, useRef, useState, FormEvent } from "react";
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
import { useAuth } from "../contexts/AuthContext";
import { useDriveConfig } from "../contexts/DriveConfigContext";
import { AppUser } from "../types";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { Plus, Pencil, Trash2, Users, List, LayoutGrid, Mail, MapPin, BadgeCheck } from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Pagination from "../components/Pagination";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

const LOCATIONS = [
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
  birthDate: "",
  address: "",
  licenseExpirationDate: "",
  location: "",
  phoneNumber: "",
  photoURL: null as string | null,
  photoDriveFileId: null as string | null,
};

export default function Drivers() {
  const { isSuperAdmin, profile } = useAuth();
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("drivers:view") as "list" | "grid") || "list";
  });
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

  // Regular admins (non-super) are scoped to their own assigned location
  const adminLocation = !isSuperAdmin ? (profile?.location || "") : "";

  // Photo selection is local-only until "Save Changes" is clicked: `photoFile`
  // holds the file waiting to be uploaded, and `photoPreviewUrl` is a local
  // object URL used just for the <img> preview. Nothing touches Drive until
  // handleSubmit runs. `originalPhotoRef` remembers what was actually saved
  // (so we know what to delete from Drive if it gets replaced/removed) and
  // `photoRemoved` marks that the user cleared an existing photo.
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
    const q = query(collection(db, "users"), where("role", "==", "driver"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    // Scope to admin's location first (super admins see all)
    let list = adminLocation
      ? drivers.filter((d) => d.location === adminLocation)
      : drivers;

    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((d) =>
        [d.name, d.email, d.address, d.location].some((f) => (f || "").toLowerCase().includes(s))
      );
    }
    return list;
  }, [drivers, search, adminLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    localStorage.setItem("drivers:view", view);
  }, [view]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, location: adminLocation || "" });
    setError("");
    resetPhotoState();
    originalPhotoRef.current = { url: null, fileId: null };
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
      location: d.location || "",
      phoneNumber: d.phoneNumber || "",
      photoURL: d.photoURL || null,
      photoDriveFileId: d.photoDriveFileId || null,
    });
    setError("");
    resetPhotoState();
    originalPhotoRef.current = { url: d.photoURL || null, fileId: d.photoDriveFileId || null };
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

  // Fired on the click that OPENS the file picker (see AvatarPicker's
  // onBeforePick), not after a file is chosen — this is what actually keeps
  // the browser from blocking the consent popup for accounts (e.g. Admins)
  // that need it: browsers only allow opening a new popup during a fresh,
  // unbroken click, and the OS-native file dialog can stay open for any
  // length of time, so authorizing here beats authorizing in onChange.
  function handleBeforePhotoPick() {
    if (driveConfig) preauthorizeDrive(driveConfig.connectedByEmail);
  }

  function handlePhotoRemove() {
    revokePreview();
    setPhotoFile(null);
    setPhotoRemoved(true);
    setPhotoError("");
    setForm((f) => ({ ...f, photoURL: null, photoDriveFileId: null }));
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
            `driver-${form.name || form.email || "photo"}-${Date.now()}.jpg`,
            driveConfig.driverFolderId,
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
          birthDate: form.birthDate || null,
          address: form.address || null,
          licenseExpirationDate: form.licenseExpirationDate || null,
          location: form.location || null,
          phoneNumber: form.phoneNumber || null,
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
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
        showSuccess(`${form.name} updated.`);
      } else {
        const uid = await createUserWithoutSignIn(form.email, form.password);
        await setDoc(doc(db, "users", uid), {
          name: form.name,
          email: form.email,
          role: "driver",
          birthDate: form.birthDate || null,
          address: form.address || null,
          licenseExpirationDate: form.licenseExpirationDate || null,
          location: form.location || null,
          phoneNumber: form.phoneNumber || null,
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess(`${form.name} added as a driver.`);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      showError(err.message || "Something went wrong while saving the driver.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(d: AppUser) {
    setDeleteTarget(d);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const d = deleteTarget;
    // Deleting the matching Firebase Auth account also requires the Admin
    // SDK; wire this up to a Cloud Function if you need full account removal.
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", d.id));
      if (d.photoDriveFileId) deletePhotoFromDrive(d.photoDriveFileId, driveConfig?.connectedByEmail); // best-effort
      showSuccess(`${d.name} deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showError(err.message || `Couldn't delete ${d.name}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={Users}
        title="Drivers"
        subtitle={adminLocation ? `${filtered.length} driver(s) in ${adminLocation}` : `${drivers.length} on record`}
        actions={
          <>
            <div className="header-search-wrap">
              <HeaderSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name or email..."
              />
            </div>
            <ViewToggle view={view} onChange={(v) => setView(v)} />
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
                cursor: "pointer",
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
            padding: "28px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <Users size={22} style={{ marginBottom: 6 }} />
          <div>No drivers found.</div>
        </div>
      ) : view === "list" ? (
        <div className="auth-table-wrap">
          <table className="auth-table">
            <thead>
              <tr>
                {["Name", "Email", "Assigned Location", "Address", "License Expiry", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id} className="admin-row">
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Avatar name={d.name} photoURL={d.photoURL} size={30} />
                      <span>{d.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{d.email}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: d.location ? "#166534" : "var(--text-muted)" }}>
                      {d.location || "All Locations"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{d.address || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{d.licenseExpirationDate || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openEdit(d)}
                      className="admin-icon-btn"
                      style={{ background: "none", border: "none", color: "var(--info)", padding: "6px", borderRadius: "7px", cursor: "pointer" }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
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
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
          }}
        >
          {paginated.map((d) => (
            <DriverCard key={d.id} driver={d} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d)} />
          ))}
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
          itemLabel="drivers"
        />
      )}

      {modalOpen && (
        <Modal title={editing ? "Edit Driver" : "Add Driver"} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && (
              <div
                style={{
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                }}
              >
                {error}
              </div>
            )}

            <AvatarPicker
              inputId="driver-photo-input"
              name={form.name || form.email || "driver"}
              photoURL={form.photoURL}
              onSelect={handlePhotoSelect}
              onBeforePick={handleBeforePhotoPick}
              onRemove={handlePhotoRemove}
              error={photoError}
              label={photoUploading ? "Uploading to Drive..." : "Photo (optional, max 5MB)"}
            />

            <Field label="Full Name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Driver's full name"
                style={inputStyle}
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                required
                disabled={!!editing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="driver@example.com"
                style={{ ...inputStyle, ...(editing ? { background: "#edf2f7", cursor: "not-allowed", color: "#4a5568" } : {}) }}
              />
              {editing && (
                <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Email changes require a backend admin action.
                </small>
              )}
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

            <Field label="Assigned Location / Office Province">
              {!isSuperAdmin && adminLocation ? (
                <input
                  disabled
                  value={adminLocation}
                  style={{
                    ...inputStyle,
                    background: "#edf2f7",
                    cursor: "not-allowed",
                    color: "#4a5568",
                  }}
                />
              ) : (
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
              )}
              <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                Drivers assigned to a specific province will be prioritized for vehicle assignments in that location.
              </small>
            </Field>

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
                boxShadow: "0 2px 8px rgba(0, 179, 119, 0.28)",
              }}
            >
              {photoUploading ? "Uploading photo..." : saving ? "Saving..." : editing ? "Save Changes" : "Add Driver"}
            </button>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog before updating driver */}
      <ConfirmDialog
        open={confirmSaveOpen}
        title="Confirm Driver Update?"
        danger={false}
        confirmLabel="Yes, Save Changes"
        confirmingLabel="Saving..."
        message={
          editing && (
            <div>
              Are you sure you want to update <strong>{form.name}</strong>?
              <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                • Location: <strong>{form.location || "All Locations"}</strong>
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
        title="Delete Driver?"
        message={
          deleteTarget && (
            <>
              Delete driver <strong>{deleteTarget.name}</strong>? This removes their profile record. This can't be
              undone.
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

function DriverCard({
  driver,
  onEdit,
  onDelete,
}: {
  driver: AppUser;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Avatar name={driver.name} photoURL={driver.photoURL} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {driver.name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Driver</div>
        </div>
        <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            className="admin-icon-btn"
            style={{ background: "none", border: "none", color: "var(--info)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="admin-icon-btn"
            style={{ background: "none", border: "none", color: "var(--danger)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mail size={12} style={{ flexShrink: 0 }} /> {driver.email}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MapPin size={12} style={{ flexShrink: 0 }} /> {driver.location ? <strong style={{ color: "#166534" }}>{driver.location}</strong> : "All Locations"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MapPin size={12} style={{ flexShrink: 0 }} /> {driver.address || "No address on file"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BadgeCheck size={12} style={{ flexShrink: 0 }} />
          {driver.licenseExpirationDate ? `License exp: ${driver.licenseExpirationDate}` : "No license expiry on file"}
        </span>
      </div>
    </div>
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
