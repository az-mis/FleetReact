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
import { AppUser, Vehicle } from "../types";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import { Avatar, AvatarPicker } from "../components/Avatar";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  List,
  LayoutGrid,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Car,
  Calendar,
  Hash,
} from "lucide-react";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Pagination from "../components/Pagination";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";
import LocationFilter from "../components/LocationFilter";

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("drivers:view") as "list" | "grid") || "grid";
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

  // Subscribe to drivers
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "driver"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) })));
    });
    return unsub;
  }, []);

  // Subscribe to vehicles to show assigned vehicle on each card
  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  // Build a map: driverId → vehicle
  const vehicleByDriverId = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => {
      if (v.assignedDriverId) map.set(v.assignedDriverId, v);
    });
    return map;
  }, [vehicles]);

  const filtered = useMemo(() => {
    let list = adminLocation
      ? drivers.filter((d) => d.location === adminLocation)
      : selectedLocation
      ? drivers.filter((d) => d.location === selectedLocation)
      : drivers;

    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((d) =>
        [d.name, d.email, d.address, d.location].some((f) => (f || "").toLowerCase().includes(s))
      );
    }
    return list;
  }, [drivers, search, adminLocation, selectedLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocation]);

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
          birthDate: form.birthDate || null,
          address: form.address || null,
          licenseExpirationDate: form.licenseExpirationDate || null,
          location: form.location || null,
          phoneNumber: form.phoneNumber || null,
          photoURL: finalPhotoURL,
          photoDriveFileId: finalPhotoDriveFileId,
          updatedAt: serverTimestamp(),
        });
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
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", d.id));
      if (d.photoDriveFileId) deletePhotoFromDrive(d.photoDriveFileId, driveConfig?.connectedByEmail);
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
      {/* Responsive grid styles */}
      <style>{`
        .drivers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .driver-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid var(--border);
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .driver-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.10);
          transform: translateY(-2px);
        }

      `}</style>

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
                placeholder="Search by name or email..."
              />
            </div>
            <ViewToggle view={view} onChange={(v) => setView(v)} />
            {isSuperAdmin && (
              <LocationFilter
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            )}
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
                whiteSpace: "nowrap",
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
            borderRadius: "14px",
            border: "1px solid var(--border)",
            padding: "48px 28px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <Users size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
          <div style={{ fontWeight: 600, fontSize: 15 }}>No drivers found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your search or filter.</div>
        </div>
      ) : view === "list" ? (
        <div className="auth-table-wrap">
          <table className="auth-table">
            <thead>
              <tr>
                {["Name", "Email", "Phone", "Assigned Location", "License Expiry", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id} className="admin-row">
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Avatar name={d.name} photoURL={d.photoURL} size={32} />
                      <span>{d.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{d.email}</td>
                  <td style={{ color: "var(--text-muted)" }}>{d.phoneNumber || "—"}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: d.location ? "#166534" : "var(--text-muted)" }}>
                      {d.location || "All Locations"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {d.licenseExpirationDate
                      ? new Date(d.licenseExpirationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
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
        <div className="drivers-grid">
          {paginated.map((d, index) => (
            <DriverCard
              key={d.id}
              driver={d}
              vehicle={vehicleByDriverId.get(d.id) || null}
              index={index + (currentPage - 1) * pageSize}
              onEdit={() => openEdit(d)}
              onDelete={() => handleDelete(d)}
            />
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

// ─── Driver Card ──────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  vehicle,
  index,
  onEdit,
  onDelete,
}: {
  driver: AppUser;
  vehicle: Vehicle | null;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = driver.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const driverId = `DRV-${String(index + 1).padStart(3, "0")}`;

  const licenseDate = driver.licenseExpirationDate
    ? new Date(driver.licenseExpirationDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const licenseStatus = (() => {
    if (!driver.licenseExpirationDate) return "none";
    const expiry = new Date(driver.licenseExpirationDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "expired";
    if (diffDays <= 60) return "expiring";
    return "valid";
  })();

  const licenseColor =
    licenseStatus === "expired"
      ? "#dc2626"
      : licenseStatus === "expiring"
      ? "#d97706"
      : "#166534";

  return (
    <div className="driver-card">
      {/* ── Top: Photo left, Info right (Top-aligned as shown in mockup) ── */}
      <div style={{ display: "flex", gap: 12, padding: "14px 14px 10px", alignItems: "flex-start" }}>

        {/* Driver photo — Rounded square left side */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 14,
            overflow: "hidden",
            flexShrink: 0,
            background: "linear-gradient(135deg, #1b4d3e 0%, #2d6a4f 60%, #3a7d5c 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {driver.photoURL ? (
            <img
              src={driver.photoURL}
              alt={driver.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          ) : (
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "-1px",
                userSelect: "none",
              }}
            >
              {initials}
            </span>
          )}
        </div>

        {/* Info — right side */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: Active badge + action buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            {/* Active badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#dcfce7",
                borderRadius: 20,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "#15803d",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Active
            </div>

            {/* Edit / Delete */}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={onEdit}
                title="Edit driver"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={onDelete}
                title="Delete driver"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "1px solid #fee2e2",
                  background: "#fff5f5",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Name */}
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#0f172a",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {driver.name}
          </div>

          {/* ID */}
          <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 3, marginTop: 2, marginBottom: 6 }}>
            <Hash size={10} />
            {driverId}
          </div>

          {/* Contact rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#475569", overflow: "hidden" }}>
              <Mail size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driver.email}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#475569" }}>
              <Phone size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
              <span>{driver.phoneNumber || "—"}</span>
            </div>
            {driver.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
                <MapPin size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
                <span style={{ fontWeight: 600, color: "#166534", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {driver.location}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Assigned Vehicle Container (Grey background rounded section) ── */}
      <div style={{ padding: "0 12px 10px" }}>
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #f1f5f9",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            ASSIGNED VEHICLE(S)
          </div>
          {vehicle ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 52,
                  height: 36,
                  borderRadius: 6,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #e2e8f0",
                }}
              >
                {vehicle.photoURL ? (
                  <img src={vehicle.photoURL} alt={vehicle.brand} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Car size={16} style={{ color: "#94a3b8" }} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {vehicle.brand} {vehicle.model}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: "#475569",
                    marginTop: 2,
                    background: "#e2e8f0",
                    display: "inline-block",
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.03em",
                  }}
                >
                  {vehicle.plateNumber}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 11.5 }}>
              <Car size={14} />
              <span>No vehicle assigned</span>
            </div>
          )}
        </div>
      </div>

      {/* ── License Info Boxes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 12px 12px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3, display: "flex", alignItems: "center", gap: 3 }}>
            <BadgeCheck size={10} />
            LICENSE NO.
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a" }}>—</div>
        </div>
        <div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3, display: "flex", alignItems: "center", gap: 3 }}>
            <Calendar size={10} />
            VALID UNTIL
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: licenseColor }}>
            {licenseDate || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── View Toggle ──────────────────────────────────────────────────────────────

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

// ─── Field ────────────────────────────────────────────────────────────────────

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
