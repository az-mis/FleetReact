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
    <div className="fade-in">
      <PageHeader icon={UserCircle} title="My Profile" subtitle="Update your personal details and avatar." />

      <div className="profile-card fade-in" style={{ maxWidth: "600px", margin: "0 auto", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div className="profile-cover" style={{ height: "68px" }} />

        <div className="profile-identity" style={{ marginTop: "-38px", padding: "0 18px 14px" }}>
          <div className="profile-avatar-ring">
            <AvatarPicker
              inputId="my-profile-photo-input"
              name={name}
              photoURL={photoURL}
              onSelect={handlePhotoSelect}
              onBeforePick={handleBeforePhotoPick}
              onRemove={handlePhotoRemove}
              error={photoError}
              label={photoUploading ? "Uploading to Drive…" : "Photo (max 5MB)"}
              size={76}
            />
          </div>
          <div className="profile-name-display" style={{ fontSize: "16px", marginTop: "8px" }}>{name || "Unnamed"}</div>
          <span className="profile-role-chip" style={{ background: roleColor + "1a", color: roleColor, fontSize: "11px", padding: "2px 10px", marginTop: "4px" }}>
            {USER_ROLE_LABEL[profile.role]}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="profile-form" style={{ padding: "4px 18px 20px", gap: "14px" }}>
          <div className="profile-grid" style={{ gap: "14px" }}>
            <section className="profile-section" style={{ gap: "10px" }}>
              <h3 style={{ fontSize: "11.5px" }}>Account Credentials</h3>
              <Field label="Full Name" required>
                <input
                  className="auth-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </Field>
              <Field label="Email Address">
                <input className="auth-input" type="email" disabled value={profile.email} style={{ background: "#f8fafc", color: "var(--text-muted)" }} />
                <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Email changes require a backend administrator.</small>
              </Field>
            </section>

            {isDriver && (
              <section className="profile-section" style={{ gap: "10px" }}>
                <h3 style={{ fontSize: "11.5px" }}>Driver Details</h3>
                <Field label="Birth Date">
                  <input
                    className="auth-input"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </Field>
                <Field label="Residential Address">
                  <input className="auth-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Calapan City" />
                </Field>
              </section>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || photoUploading}
            style={{
              height: "38px",
              marginTop: "6px",
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
      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4a5568" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

