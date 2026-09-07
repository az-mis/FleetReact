import React, { useRef, useState, FormEvent } from "react";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useDriveConfig } from "../contexts/DriveConfigContext";
import PageHeader from "../components/PageHeader";
import { AvatarPicker } from "../components/Avatar";
import { UserCircle } from "lucide-react";
import { USER_ROLE_LABEL, USER_ROLE_COLOR } from "../types";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Lets whoever is logged in (super admin, admin, or driver) update their own
 * name, photo, and — for drivers — their birth date and address. Everyone
 * only ever edits their own doc here (users/{currentUser.uid}), so unlike
 * Admins.tsx / Drivers.tsx this never needs a role check or a picker for
 * *which* record to edit. Email/role/license expiry stay read-only: email is
 * tied to the Firebase Auth identity, and role/license are things only an
 * admin should be able to change.
 */
export default function MyProfile() {
  const { currentUser, profile, role, isDriver } = useAuth();
  const { showSuccess, showError } = useToast();
  const { config: driveConfig } = useDriveConfig();

  const [name, setName] = useState(profile?.name || "");
  const [birthDate, setBirthDate] = useState(profile?.birthDate || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [photoURL, setPhotoURL] = useState<string | null>(profile?.photoURL || null);
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const photoFileRef = useRef<File | null>(null);
  const photoRemovedRef = useRef(false);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const originalPhotoRef = useRef<{ url: string | null; fileId: string | null }>({
    url: profile?.photoURL || null,
    fileId: profile?.photoDriveFileId || null,
  });

  function revokePreview() {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }
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
    photoFileRef.current = file;
    photoRemovedRef.current = false;
    setPhotoURL(preview);
  }

  // Fired on the click that OPENS the file picker (see AvatarPicker's
  // onBeforePick), not after a file is chosen. Browsers only allow opening
  // a new popup window during a fresh, unbroken click, and the OS-native
  // file dialog can stay open for any length of time — so kicking off
  // Drive's consent popup here, instead of in handlePhotoSelect's onChange,
  // is what keeps it from being silently blocked.
  function handleBeforePhotoPick() {
    if (driveConfig) preauthorizeDrive(driveConfig.connectedByEmail);
  }

  function handlePhotoRemove() {
    revokePreview();
    photoFileRef.current = null;
    photoRemovedRef.current = true;
    setPhotoError("");
    setPhotoURL(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !profile) return;
    setSaving(true);
    try {
      let finalPhotoURL = originalPhotoRef.current.url;
      let finalPhotoDriveFileId = originalPhotoRef.current.fileId;

      if (photoFileRef.current) {
        if (!driveConfig) {
          throw new Error("Google Drive isn't connected yet. Ask a super admin to connect it in Content Settings.");
        }
        setPhotoUploading(true);
        try {
          const blob = await compressImageToBlob(photoFileRef.current);
          const folderId = role === "driver" ? driveConfig.driverFolderId : driveConfig.adminFolderId;
          const { fileId, url } = await uploadPhotoToDrive(
            blob,
            `profile-${name || profile.email || "photo"}-${Date.now()}.jpg`,
            folderId,
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
      } else if (photoRemovedRef.current) {
        if (originalPhotoRef.current.fileId)
          deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig?.connectedByEmail); // best-effort
        finalPhotoURL = null;
        finalPhotoDriveFileId = null;
      }

      const updates: Record<string, any> = {
        name,
        photoURL: finalPhotoURL,
        photoDriveFileId: finalPhotoDriveFileId,
        updatedAt: serverTimestamp(),
      };
      if (isDriver) {
        updates.birthDate = birthDate || null;
        updates.address = address || null;
      }

      await updateDoc(doc(db, "users", currentUser.uid), updates);

      // Keep vehicles.assignedDriverName (a denormalized copy) in sync, same
      // as Drivers.tsx does when an admin renames a driver.
      if (isDriver && name !== profile.name) {
        const assignedVehicles = await getDocs(
          query(collection(db, "vehicles"), where("assignedDriverId", "==", currentUser.uid))
        );
        if (!assignedVehicles.empty) {
          const batch = writeBatch(db);
          assignedVehicles.docs.forEach((v) => {
            batch.update(v.ref, { assignedDriverName: name, updatedAt: serverTimestamp() });
          });
          await batch.commit();
        }
      }

      originalPhotoRef.current = { url: finalPhotoURL, fileId: finalPhotoDriveFileId };
      photoFileRef.current = null;
      photoRemovedRef.current = false;
      showSuccess("Profile updated.");
    } catch (err: any) {
      showError(err.message || "Something went wrong while saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  const roleColor = USER_ROLE_COLOR[profile.role];

  return (
    <div>
      <PageHeader icon={UserCircle} title="My Profile" subtitle="Update your personal information." />

      <div className="profile-card fade-in">
        <div className="profile-cover" />

        <div className="profile-identity">
          <AvatarPicker
            inputId="my-profile-photo-input"
            name={name}
            photoURL={photoURL}
            onSelect={handlePhotoSelect}
            onBeforePick={handleBeforePhotoPick}
            onRemove={handlePhotoRemove}
            error={photoError}
            label={photoUploading ? "Uploading to Drive…" : "Photo (optional, max 5MB)"}
            size={92}
          />
          <div className="profile-name-display">{name || "Unnamed"}</div>
          <span className="profile-role-chip" style={{ background: roleColor + "1a", color: roleColor }}>
            {USER_ROLE_LABEL[profile.role]}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-grid">
            <section className="profile-section">
              <h3>Account</h3>
              <Field label="Full Name" required>
                <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Email">
                <input type="email" disabled value={profile.email} style={inputStyle} />
                <small style={{ color: "var(--text-muted)" }}>Email changes require a backend admin action.</small>
              </Field>
            </section>

            {isDriver && (
              <section className="profile-section">
                <h3>Personal Details</h3>
                <Field label="Birth Date">
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Address">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
                </Field>
              </section>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || photoUploading}
            style={{
              alignSelf: "flex-end",
              padding: "11px 28px",
              borderRadius: "8px",
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              cursor: saving || photoUploading ? "default" : "pointer",
            }}
          >
            {photoUploading ? "Uploading photo..." : saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
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
