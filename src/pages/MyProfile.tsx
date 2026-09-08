import React, { useRef, useState, FormEvent, useMemo } from "react";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useDriveConfig } from "../contexts/DriveConfigContext";
import PageHeader from "../components/PageHeader";
import { AvatarPicker } from "../components/Avatar";
import {
  UserCircle,
  Mail,
  User,
  Calendar,
  MapPin,
  Award,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { USER_ROLE_LABEL, USER_ROLE_COLOR } from "../types";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

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
            deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig.connectedByEmail);
          finalPhotoURL = url;
          finalPhotoDriveFileId = fileId;
        } catch (err: any) {
          throw new Error(err.message || "Couldn't upload that photo.");
        } finally {
          setPhotoUploading(false);
        }
      } else if (photoRemovedRef.current) {
        if (originalPhotoRef.current.fileId)
          deletePhotoFromDrive(originalPhotoRef.current.fileId, driveConfig?.connectedByEmail);
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

  // License status check
  const licenseInfo = useMemo(() => {
    if (!profile?.licenseExpirationDate) return null;
    const exp = new Date(profile.licenseExpirationDate);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { status: "expired", label: "Expired", bg: "#fdd9d9", color: "#a11e1e", border: "#f7b8b8", icon: ShieldAlert };
    }
    if (diffDays <= 30) {
      return { status: "expiring_soon", label: `Expires in ${diffDays}d`, bg: "#fff3cd", color: "#856404", border: "#ffeeba", icon: Clock };
    }
    return { status: "valid", label: "Valid", bg: "#d9f5e5", color: "#0f7a44", border: "#a9e6c4", icon: ShieldCheck };
  }, [profile?.licenseExpirationDate]);

  if (!profile) return null;

  const roleColor = USER_ROLE_COLOR[profile.role];

  return (
    <div className="fade-in">
      <PageHeader icon={UserCircle} title="My Profile" subtitle="Manage your personal account settings and credentials." />

      <div className="profile-card fade-in" style={{ maxWidth: "680px", margin: "0 auto", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        {/* Banner Cover */}
        <div
          className="profile-cover"
          style={{
            height: "80px",
            background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 60%, var(--primary-light) 100%)",
            position: "relative",
          }}
        />

        {/* Identity Section */}
        <div className="profile-identity" style={{ marginTop: "-44px", padding: "0 24px 16px" }}>
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
              size={84}
            />
          </div>
          <div className="profile-name-display" style={{ fontSize: "17px", fontWeight: 800, marginTop: "8px", color: "#1a202c" }}>
            {name || "Unnamed"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <span
              className="profile-role-chip"
              style={{
                background: roleColor + "18",
                color: roleColor,
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: "999px",
                border: `1px solid ${roleColor}33`,
              }}
            >
              {USER_ROLE_LABEL[profile.role]}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>•</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{profile.email}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="profile-form" style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
            
            {/* Account Credentials Column */}
            <section
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                <User size={14} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#2d3748", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Account Credentials
                </h3>
              </div>

              <Field label="Full Name" icon={User} required>
                <input
                  className="auth-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </Field>

              <Field label="Email Address" icon={Mail}>
                <div style={{ position: "relative" }}>
                  <input
                    className="auth-input"
                    type="email"
                    disabled
                    value={profile.email}
                    style={{ background: "#edf2f7", color: "#4a5568", paddingRight: "28px", cursor: "not-allowed" }}
                  />
                  <Lock size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#a0aec0" }} />
                </div>
                <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                  Account email is managed by your administrator.
                </small>
              </Field>
            </section>

            {/* Driver Details Column */}
            {isDriver && (
              <section
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                  <Award size={14} style={{ color: "var(--primary)" }} />
                  <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#2d3748", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Driver Details
                  </h3>
                </div>

                <Field label="Birth Date" icon={Calendar}>
                  <input
                    className="auth-input"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </Field>

                <Field label="Residential Address" icon={MapPin}>
                  <input
                    className="auth-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Calapan City, Oriental Mindoro"
                  />
                </Field>

                <Field label="Driver's License Expiration" icon={Award}>
                  <div style={{ position: "relative" }}>
                    <input
                      className="auth-input"
                      disabled
                      value={profile.licenseExpirationDate || "No expiration date on file"}
                      style={{
                        background: "#edf2f7",
                        color: "#4a5568",
                        paddingRight: licenseInfo ? "96px" : "28px",
                        cursor: "not-allowed",
                        fontWeight: 600,
                      }}
                    />
                    {licenseInfo ? (
                      <span
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: licenseInfo.bg,
                          color: licenseInfo.color,
                          border: `1px solid ${licenseInfo.border}`,
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <licenseInfo.icon size={11} />
                        {licenseInfo.label}
                      </span>
                    ) : (
                      <Lock size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#a0aec0" }} />
                    )}
                  </div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                    Managed and verified by your fleet administrator.
                  </small>
                </Field>
              </section>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
            <button
              type="submit"
              disabled={saving || photoUploading}
              style={{
                height: "40px",
                padding: "0 22px",
                borderRadius: "9px",
                border: "none",
                background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: saving || photoUploading ? "not-allowed" : "pointer",
                boxShadow: "0 3px 10px rgba(0, 179, 119, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <CheckCircle2 size={15} />
              {photoUploading ? "Uploading photo..." : saving ? "Saving changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon?: any;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4a5568", display: "flex", alignItems: "center", gap: "5px" }}>
        {Icon && <Icon size={12} style={{ color: "var(--text-muted)" }} />}
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}


