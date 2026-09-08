import React, { useEffect, useMemo, useRef, useState, FormEvent } from "react";
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
import { useToast } from "../contexts/ToastContext";
import { useDriveConfig } from "../contexts/DriveConfigContext";
import { Vehicle } from "../types";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import HeaderSearchInput from "../components/HeaderSearchInput";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";
import { Plus, Pencil, Trash2, Truck, List, LayoutGrid, Gauge, Palette, Fuel } from "lucide-react";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

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
  photoURL: null as string | null,
  photoDriveFileId: null as string | null,
};

export default function Vehicles() {
  const { isSuperAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { config: driveConfig } = useDriveConfig();
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
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    resetPhotoState();
    originalPhotoRef.current = { url: null, fileId: null };
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
      photoURL: v.photoURL || null,
      photoDriveFileId: v.photoDriveFileId || null,
    });
    setError("");
    resetPhotoState();
    originalPhotoRef.current = { url: v.photoURL || null, fileId: v.photoDriveFileId || null };
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
            `vehicle-${form.plateNumber || "photo"}-${Date.now()}.jpg`,
            driveConfig.vehicleFolderId,
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

      const payload = {
        ...form,
        plateNumber: form.plateNumber.trim(),
        year: Number(form.year),
        odometer: Number(form.odometer),
        photoURL: finalPhotoURL,
        photoDriveFileId: finalPhotoDriveFileId,
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
        showSuccess(`${payload.plateNumber} updated.`);
      } else {
        await addDoc(collection(db, "vehicles"), { ...payload, createdAt: serverTimestamp() });
        showSuccess(`${payload.plateNumber} registered.`);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      showError(err.message || "Something went wrong while saving the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(v: Vehicle) {
    setDeleteTarget(v);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const v = deleteTarget;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "vehicles", v.id));
      if (v.photoDriveFileId) deletePhotoFromDrive(v.photoDriveFileId, driveConfig?.connectedByEmail); // best-effort
      showSuccess(`${v.plateNumber} deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showError(err.message || `Couldn't delete ${v.plateNumber}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={Truck}
        title="Vehicles List"
        subtitle={`${vehicles.length} registered`}
        actions={
          <>
            <div className="header-search-wrap">
              <HeaderSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search plate, brand, model..."
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
            padding: "28px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <Truck size={22} style={{ marginBottom: 6 }} />
          <div>No vehicles found.</div>
        </div>
      ) : view === "list" ? (
        <div className="auth-table-wrap">
          <table className="auth-table">
            <thead>
              <tr>
                {["", "Plate #", "Brand / Model", "Year", "Color", "Odometer", "Type", "Fuel", ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="admin-row">
                  <td style={{ width: 44, paddingRight: 0 }}>
                    <Avatar photoURL={v.photoURL} fallback="icon" icon={Truck} size={30} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{v.plateNumber}</td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {v.brand} {v.model}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{v.year}</td>
                  <td style={{ color: "var(--text-muted)" }}>{v.color}</td>
                  <td style={{ color: "var(--text-muted)" }}>{v.odometer.toLocaleString()} km</td>
                  <td style={{ color: "var(--text-muted)" }}>{v.vehicleType || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{v.fuelType || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openEdit(v)}
                      className="admin-icon-btn"
                      style={{ background: "none", border: "none", color: "var(--info)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
                    >
                      <Pencil size={14} />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(v)}
                        className="admin-icon-btn"
                        style={{ background: "none", border: "none", color: "var(--danger)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              canDelete={isSuperAdmin}
              onEdit={() => openEdit(v)}
              onDelete={() => handleDelete(v)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? "Edit Vehicle" : "Register Vehicle"} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {error && (
              <div
                style={{
                  background: "#fff5f5",
                  color: "var(--danger)",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
              <AvatarPicker
                inputId="vehicle-photo-input"
                photoURL={form.photoURL}
                name={form.plateNumber || "Vehicle"}
                fallback="icon"
                icon={Truck}
                size={76}
                onSelect={handlePhotoSelect}
                onRemove={handlePhotoRemove}
                onBeforePick={handleBeforePhotoPick}
                error={photoError}
                label={photoUploading ? "Uploading to Drive…" : "Vehicle photo (optional, max 5MB)"}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Plate Number" required>
                <input
                  required
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Brand" required>
                <input required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="Model" required>
              <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Chassis Number">
                <input
                  value={form.chassisNumber}
                  onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Engine Number">
                <input
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
              {photoUploading ? "Uploading photo..." : saving ? "Saving..." : editing ? "Save Changes" : "Register Vehicle"}
            </button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Vehicle?"
        message={
          deleteTarget && (
            <>
              Delete vehicle <strong>{deleteTarget.plateNumber}</strong>? This cannot be undone.
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

function VehicleCard({
  vehicle,
  canDelete,
  onEdit,
  onDelete,
}: {
  vehicle: Vehicle;
  canDelete: boolean;
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
        <Avatar photoURL={vehicle.photoURL} fallback="icon" icon={Truck} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vehicle.plateNumber}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vehicle.brand} {vehicle.model} · {vehicle.year}
          </div>
        </div>
        <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            className="admin-icon-btn"
            style={{ background: "none", border: "none", color: "var(--info)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
          >
            <Pencil size={14} />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="admin-icon-btn"
              style={{ background: "none", border: "none", color: "var(--danger)", padding: "5px", borderRadius: "6px", cursor: "pointer" }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Palette size={12} style={{ flexShrink: 0 }} /> {vehicle.color}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Gauge size={12} style={{ flexShrink: 0 }} /> {vehicle.odometer.toLocaleString()} km
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Fuel size={12} style={{ flexShrink: 0 }} />
          {vehicle.vehicleType || "—"}{vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
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
