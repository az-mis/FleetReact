import React, { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Settings2,
  Truck,
  UserCog,
  ClipboardList,
  Users,
  Megaphone,
  ShieldCheck,
  Car,
  HardDrive,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Camera,
  Trash2,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { useDriveConfig } from "../contexts/DriveConfigContext";
import { useBranding } from "../contexts/BrandingContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { compressImageToBlob } from "../lib/imageCompress";
import { uploadPhotoToDrive, deletePhotoFromDrive, preauthorizeDrive } from "../lib/googleDrive";
import { AdminModuleFlags, AnnouncementConfig, BRANDING_DOC_PATH, DriverModuleFlags, DriveConfig } from "../types";
import { connectGoogleDrive } from "../lib/googleDrive";

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

export default function ContentSettings() {
  const { isSuperAdmin, profile } = useAuth();
  const { flags, loading, updateFlags } = useFeatureFlags();
  const { config: driveConfig } = useDriveConfig();
  const { branding } = useBranding();
  const { showSuccess, showError } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [confirmRemoveLogoOpen, setConfirmRemoveLogoOpen] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState("");
  const [confirmRemoveBgOpen, setConfirmRemoveBgOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  /** Compresses, uploads to the "FMS Photos" root folder, saves the new URL
   *  to settings/appBranding, and best-effort deletes the old Drive file —
   *  mirrors the photo-save step in Vehicles.tsx/Drivers.tsx, just without
   *  a surrounding form since this is a single always-on setting. */
  async function handleLogoSelect(file: File) {
    setLogoError("");
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Image is too large. Please choose one under 5MB.");
      return;
    }
    if (!driveConfig) {
      setLogoError("Connect Google Drive above first.");
      return;
    }
    setLogoUploading(true);
    try {
      const blob = await compressImageToBlob(file);
      const { fileId, url } = await uploadPhotoToDrive(
        blob,
        `app-logo-${Date.now()}.jpg`,
        driveConfig.rootFolderId,
        driveConfig.connectedByEmail
      );
      await setDoc(
        doc(db, ...BRANDING_DOC_PATH),
        { logoURL: url, logoDriveFileId: fileId, updatedAt: serverTimestamp(), updatedByName: profile?.name || null },
        { merge: true }
      );
      if (branding?.logoDriveFileId) deletePhotoFromDrive(branding.logoDriveFileId, driveConfig.connectedByEmail); // best-effort
      showSuccess("Logo updated.");
    } catch (err: any) {
      setLogoError(err.message || "Couldn't upload that logo.");
      showError(err.message || "Couldn't upload that logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  function handleLogoRemove() {
    setConfirmRemoveLogoOpen(true);
  }

  // Fired on the click that OPENS the file picker (see LogoEditor's
  // onBeforePick), not after a file is chosen — browsers only allow
  // opening a new popup during a fresh, unbroken click, and the OS-native
  // file dialog can stay open for any length of time, so authorizing here
  // is what actually keeps the Drive consent popup from being blocked.
  function handleBeforeLogoPick() {
    if (driveConfig) preauthorizeDrive(driveConfig.connectedByEmail);
  }

  async function confirmLogoRemove() {
    setLogoError("");
    setRemovingLogo(true);
    try {
      await setDoc(
        doc(db, ...BRANDING_DOC_PATH),
        { logoURL: null, logoDriveFileId: null, updatedAt: serverTimestamp(), updatedByName: profile?.name || null },
        { merge: true }
      );
      if (branding?.logoDriveFileId) deletePhotoFromDrive(branding.logoDriveFileId, driveConfig?.connectedByEmail); // best-effort
      showSuccess("Logo removed.");
    } catch (err: any) {
      showError(err.message || "Couldn't remove the logo.");
    } finally {
      setRemovingLogo(false);
      setConfirmRemoveLogoOpen(false);
    }
  }

  /** Same flow as handleLogoSelect, for the Login screen's background photo. */
  async function handleBgSelect(file: File) {
    setBgError("");
    if (!file.type.startsWith("image/")) {
      setBgError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setBgError("Image is too large. Please choose one under 5MB.");
      return;
    }
    if (!driveConfig) {
      setBgError("Connect Google Drive above first.");
      return;
    }
    setBgUploading(true);
    try {
      const blob = await compressImageToBlob(file);
      const { fileId, url } = await uploadPhotoToDrive(
        blob,
        `login-background-${Date.now()}.jpg`,
        driveConfig.rootFolderId,
        driveConfig.connectedByEmail
      );
      await setDoc(
        doc(db, ...BRANDING_DOC_PATH),
        {
          loginBackgroundURL: url,
          loginBackgroundDriveFileId: fileId,
          updatedAt: serverTimestamp(),
          updatedByName: profile?.name || null,
        },
        { merge: true }
      );
      if (branding?.loginBackgroundDriveFileId)
        deletePhotoFromDrive(branding.loginBackgroundDriveFileId, driveConfig.connectedByEmail); // best-effort
      showSuccess("Login background updated.");
    } catch (err: any) {
      setBgError(err.message || "Couldn't upload that image.");
      showError(err.message || "Couldn't upload that image.");
    } finally {
      setBgUploading(false);
    }
  }

  function handleBgRemove() {
    setConfirmRemoveBgOpen(true);
  }

  // Same rationale as handleBeforeLogoPick, for the background photo.
  function handleBeforeBgPick() {
    if (driveConfig) preauthorizeDrive(driveConfig.connectedByEmail);
  }

  async function confirmBgRemove() {
    setBgError("");
    setRemovingBg(true);
    try {
      await setDoc(
        doc(db, ...BRANDING_DOC_PATH),
        {
          loginBackgroundURL: null,
          loginBackgroundDriveFileId: null,
          updatedAt: serverTimestamp(),
          updatedByName: profile?.name || null,
        },
        { merge: true }
      );
      if (branding?.loginBackgroundDriveFileId)
        deletePhotoFromDrive(branding.loginBackgroundDriveFileId, driveConfig?.connectedByEmail); // best-effort
      showSuccess("Login background removed. The default illustration will show instead.");
    } catch (err: any) {
      showError(err.message || "Couldn't remove the background image.");
    } finally {
      setRemovingBg(false);
      setConfirmRemoveBgOpen(false);
    }
  }

  async function handleConnectDrive() {
    setConnectingDrive(true);
    try {
      await connectGoogleDrive(profile?.name || "Unknown admin");
      showSuccess(
        driveConfig
          ? "Reconnected to Google Drive."
          : "Connected! The \"FMS Photos\" folder (with Admins/Vehicles/Drivers subfolders) was created in your Drive."
      );
    } catch (err: any) {
      showError(err.message || "Couldn't connect to Google Drive.");
    } finally {
      setConnectingDrive(false);
    }
  }

  async function toggleAdminModule(key: keyof AdminModuleFlags) {
    setSavingKey(`admin-${key}`);
    try {
      await updateFlags({ adminModules: { [key]: !flags.adminModules[key] } });
      showSuccess("Updated. Admins will see this take effect immediately.");
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleDriverModule(key: keyof DriverModuleFlags) {
    setSavingKey(`driver-${key}`);
    try {
      await updateFlags({ driverModules: { [key]: !flags.driverModules[key] } });
      showSuccess("Updated. Drivers will see this take effect immediately.");
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  }

  return (
    <div>
      <PageHeader
        icon={Settings2}
        title="Content Settings"
        subtitle={
          isSuperAdmin
            ? "Enable or disable modules and content shown to Admins and Drivers."
            : "Control what content is shown to Drivers on their Dashboard."
        }
      />

      {isSuperAdmin && (
        <Section
          icon={HardDrive}
          title="Google Drive (photo storage)"
          description="Admin, vehicle, and driver photos upload to a Google Drive folder in your account, since Firebase Storage isn't free anymore. Connect once — the folder structure is created automatically."
        >
          <DriveConnectionCard
            driveConfig={driveConfig}
            connecting={connectingDrive}
            onConnect={handleConnectDrive}
          />
        </Section>
      )}

      {isSuperAdmin && (
        <Section
          icon={ImageIcon}
          title="App Logo"
          description="Shown in the sidebar, header, and login screen across the app. Stored in the same 'FMS Photos' Drive folder as other photos."
        >
          <LogoEditor
            logoURL={branding?.logoURL || null}
            uploading={logoUploading}
            disabled={!driveConfig}
            error={logoError}
            onSelect={handleLogoSelect}
            onBeforePick={handleBeforeLogoPick}
            onRemove={handleLogoRemove}
          />
        </Section>
      )}

      {isSuperAdmin && (
        <Section
          icon={ImageIcon}
          title="Login Background"
          description="The photo shown behind the branding panel on the Login screen. Leave unset to keep the default illustration."
        >
          <LogoEditor
            logoURL={branding?.loginBackgroundURL || null}
            uploading={bgUploading}
            disabled={!driveConfig}
            error={bgError}
            onSelect={handleBgSelect}
            onBeforePick={handleBeforeBgPick}
            onRemove={handleBgRemove}
            shape="wide"
            noneLabel="No background set"
            uploadLabel="Upload Background"
            replaceLabel="Replace Background"
            currentLabel="Current background"
            hint="Landscape photo works best (e.g. fleet, vehicles, or a facility shot), up to 5MB."
            visibilityHint="Visible on the logged-out Login screen, behind the branding panel."
          />
        </Section>
      )}

      {isSuperAdmin && (
        <Section
          icon={ShieldCheck}
          title="Admin modules"
          description="Turn these off to hide the page from the sidebar and block direct navigation — for the admin role only. Super admins always keep full access."
        >
          <ToggleRow
            icon={Truck}
            label="Vehicles List"
            description="Vehicle list, records, and details."
            checked={flags.adminModules.vehicles}
            saving={savingKey === "admin-vehicles"}
            onChange={() => toggleAdminModule("vehicles")}
          />
          <ToggleRow
            icon={UserCog}
            label="Vehicle Assigning"
            description="Assigning a permanent driver to each vehicle."
            checked={flags.adminModules.vehicleAssigning}
            saving={savingKey === "admin-vehicleAssigning"}
            onChange={() => toggleAdminModule("vehicleAssigning")}
          />
          <ToggleRow
            icon={ClipboardList}
            label="Vehicle Requests"
            description="Reviewing and confirming public vehicle requests."
            checked={flags.adminModules.vehicleRequests}
            saving={savingKey === "admin-vehicleRequests"}
            onChange={() => toggleAdminModule("vehicleRequests")}
          />
          <ToggleRow
            icon={Users}
            label="Drivers"
            description="Managing driver accounts and records."
            checked={flags.adminModules.drivers}
            saving={savingKey === "admin-drivers"}
            onChange={() => toggleAdminModule("drivers")}
          />
        </Section>
      )}

      <Section
        icon={Users}
        title="Driver dashboard content"
        description="Controls what a signed-in driver sees on their Dashboard."
      >
        <ToggleRow
          icon={Car}
          label="My Assigned Vehicle card"
          description="Shows the vehicle currently assigned to the signed-in driver."
          checked={flags.driverModules.showAssignedVehicle}
          saving={savingKey === "driver-showAssignedVehicle"}
          onChange={() => toggleDriverModule("showAssignedVehicle")}
        />
      </Section>

      {isSuperAdmin && (
        <AnnouncementSection
          icon={Megaphone}
          title="Admin announcement"
          description="A message shown at the top of the Dashboard for admin accounts."
          flagKey="adminAnnouncement"
          config={flags.adminAnnouncement}
          updateFlags={updateFlags}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      <AnnouncementSection
        icon={Megaphone}
        title="Driver announcement"
        description={
          isSuperAdmin
            ? "A message shown at the top of the Dashboard for driver accounts. Admins can also set this one."
            : "A message shown at the top of the Dashboard for driver accounts."
        }
        flagKey="driverAnnouncement"
        config={flags.driverAnnouncement}
        updateFlags={updateFlags}
        showSuccess={showSuccess}
        showError={showError}
      />

      {confirmRemoveLogoOpen && (
        <Modal title="Remove logo?" onClose={() => !removingLogo && setConfirmRemoveLogoOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  background: "#fff5f5",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <p style={{ fontSize: "13.5px", color: "#4a5568", lineHeight: 1.5, marginTop: "6px" }}>
                This removes the logo everywhere it's shown (sidebar, header, and login screen) and can't be
                undone — you'll need to upload it again to bring it back.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirmRemoveLogoOpen(false)}
                disabled={removingLogo}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "#2d3748",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: removingLogo ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogoRemove}
                disabled={removingLogo}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: removingLogo ? "default" : "pointer",
                }}
              >
                {removingLogo ? "Removing…" : "Remove Logo"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmRemoveBgOpen}
        title="Remove login background?"
        message="This removes the custom background photo from the Login screen — it'll fall back to the default illustration. This can't be undone; you'll need to upload it again to bring it back."
        confirmLabel="Remove Background"
        confirmingLabel="Removing…"
        loading={removingBg}
        onCancel={() => setConfirmRemoveBgOpen(false)}
        onConfirm={confirmBgRemove}
      />
    </div>
  );
}

// Self-contained enable-toggle + editable-message block for one of the two
// announcement banners. Kept as one component since both super_admin (admin
// + driver banners) and plain admin (driver banner only) render it the same
// way — the only difference is which `flagKey` gets written to, and Firestore
// rules enforce who's actually allowed to write which one.
function AnnouncementSection({
  icon,
  title,
  description,
  flagKey,
  config,
  updateFlags,
  showSuccess,
  showError,
}: {
  icon: any;
  title: string;
  description: string;
  flagKey: "adminAnnouncement" | "driverAnnouncement";
  config: AnnouncementConfig;
  updateFlags: (patch: any) => Promise<void>;
  showSuccess: (m: string) => void;
  showError: (m: string) => void;
}) {
  const [draft, setDraft] = useState(config.message);
  const [dirty, setDirty] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(config.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.message]);

  async function toggleEnabled() {
    setSavingToggle(true);
    try {
      const next = !config.enabled;
      await updateFlags({ [flagKey]: { enabled: next } });
      showSuccess(next ? "Announcement banner turned on." : "Announcement banner turned off.");
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingToggle(false);
    }
  }

  async function saveMessage() {
    setSavingMessage(true);
    try {
      await updateFlags({ [flagKey]: { message: draft } });
      setDirty(false);
      showSuccess("Announcement saved.");
    } catch (e: any) {
      showError(e.message || "Couldn't save the announcement.");
    } finally {
      setSavingMessage(false);
    }
  }

  return (
    <Section icon={icon} title={title} description={description}>
      <ToggleRow
        icon={Megaphone}
        label="Show announcement banner"
        description={config.enabled ? "Currently visible to its audience — preview below." : "Currently hidden."}
        checked={config.enabled}
        saving={savingToggle}
        onChange={toggleEnabled}
      />

      <div style={{ padding: "10px 4px 4px" }}>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Vehicle Requests will be down for maintenance this Saturday."
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            fontSize: "13.5px",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
          <button
            onClick={saveMessage}
            disabled={savingMessage || !dirty}
            style={{
              padding: "9px 18px",
              borderRadius: "9px",
              border: "none",
              background: dirty ? "var(--primary)" : "var(--border)",
              color: "#fff",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: dirty ? "pointer" : "default",
            }}
          >
            {savingMessage ? "Saving…" : "Save message"}
          </button>
        </div>

        {config.enabled && config.message.trim() && (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "6px",
              }}
            >
              Preview — this is what they'll see, not shown on your own Dashboard
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                background: "#fffbeb",
                border: "1px solid #fbd38d",
                color: "#7b5b0a",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              <Megaphone size={17} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span style={{ whiteSpace: "pre-wrap" }}>{draft.trim() ? draft : config.message}</span>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// Same left-tile / right-details layout as LogoEditor, for visual
// consistency between the two "external service" cards at the top of this
// page. Left: a big status tile (green + check when connected, dashed +
// HardDrive icon when not). Right: connection details/actions.
function DriveConnectionCard({
  driveConfig,
  connecting,
  onConnect,
}: {
  driveConfig: DriveConfig | null;
  connecting: boolean;
  onConnect: () => void;
}) {
  const connected = !!driveConfig;
  return (
    <div style={{ padding: "6px 4px 4px" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: "20px" }}>
        <div
          style={{
            width: 116,
            height: 116,
            flexShrink: 0,
            borderRadius: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: connected ? "rgba(26,107,60,0.08)" : "rgba(160,174,192,0.1)",
            border: connected ? "1px solid rgba(26,107,60,0.25)" : "1.5px dashed var(--border)",
            color: connected ? "var(--primary)" : "#a0aec0",
          }}
        >
          {connected ? <CheckCircle2 size={40} strokeWidth={1.6} /> : <HardDrive size={34} strokeWidth={1.6} />}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a202c" }}>
              {connected ? `Connected by ${driveConfig!.connectedByName}` : "Not connected"}
            </div>
            {connected && driveConfig!.connectedByEmail && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                {driveConfig!.connectedByEmail}
              </div>
            )}
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {connected ? (
                <a
                  href={`https://drive.google.com/drive/folders/${driveConfig!.rootFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--text-muted)" }}
                >
                  Open "FMS Photos" folder in Drive <ExternalLink size={12} />
                </a>
              ) : (
                "Photo uploads (Admins, Drivers, Vehicles, App Logo) won't work until this is set up."
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 16px",
                borderRadius: "9px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: connecting ? "default" : "pointer",
              }}
            >
              <HardDrive size={14} />
              {connected
                ? connecting
                  ? "Reconnecting…"
                  : "Reconnect / switch account"
                : connecting
                ? "Connecting…"
                : "Connect Google Drive"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Left: large square preview of the current logo (or an empty state) that
// doubles as the "change logo" click target. Right: status text + explicit
// Upload/Replace and Remove buttons — bigger, more legible target than the
// small AvatarPicker used for per-record photos elsewhere, since this is a
// one-off, high-visibility setting rather than a repeated list-row action.
function LogoEditor({
  logoURL,
  uploading,
  disabled,
  error,
  onSelect,
  onBeforePick,
  onRemove,
  shape = "square",
  noneLabel = "No logo set",
  uploadLabel = "Upload Logo",
  replaceLabel = "Replace Logo",
  currentLabel = "Current logo",
  hint = "PNG or JPG, square works best, up to 5MB.",
  visibilityHint = "Visible to everyone across the app, including logged-out visitors on the Login screen.",
}: {
  logoURL: string | null;
  uploading: boolean;
  disabled: boolean;
  error?: string;
  onSelect: (file: File) => void;
  /** Called synchronously when the tile/button is clicked — BEFORE the
   *  OS-native file dialog opens, not after a file is chosen. Browsers only
   *  allow opening a new popup window during a fresh, unbroken click, and
   *  the native dialog can stay open for any length of time, so this is
   *  where Drive's consent popup needs to be kicked off (see
   *  preauthorizeDrive) rather than in onSelect's onChange. */
  onBeforePick?: () => void;
  onRemove: () => void;
  shape?: "square" | "wide";
  noneLabel?: string;
  uploadLabel?: string;
  replaceLabel?: string;
  currentLabel?: string;
  hint?: string;
  visibilityHint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tileSize = shape === "wide" ? { width: 176, height: 116 } : { width: 116, height: 116 };

  function openPicker() {
    if (disabled || uploading) return;
    onBeforePick?.();
    inputRef.current?.click();
  }

  return (
    <div style={{ padding: "6px 4px 4px" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: "20px", flexWrap: "wrap" }}>
        <div
          onClick={openPicker}
          role="button"
          aria-label={logoURL ? "Change image" : "Upload image"}
          style={{
            position: "relative",
            width: tileSize.width,
            height: tileSize.height,
            flexShrink: 0,
            borderRadius: "18px",
            overflow: "hidden",
            cursor: disabled || uploading ? "default" : "pointer",
            background: logoURL ? "#f7fafc" : "rgba(26,107,60,0.06)",
            border: logoURL ? "1px solid var(--border)" : "1.5px dashed rgba(26,107,60,0.35)",
            opacity: uploading ? 0.6 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          {logoURL ? (
            <img src={logoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                color: "var(--primary)",
              }}
            >
              <ImageIcon size={30} strokeWidth={1.6} />
              <span style={{ fontSize: "10.5px", fontWeight: 600, textAlign: "center", padding: "0 8px", color: "var(--text-muted)" }}>
                {noneLabel}
              </span>
            </div>
          )}

          {!disabled && !uploading && (
            <div
              style={{
                position: "absolute",
                bottom: 6,
                right: 6,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--primary)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            >
              <Camera size={13} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a202c" }}>
              {logoURL ? currentLabel : noneLabel}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {disabled ? "Connect Google Drive above first." : uploading ? "Uploading to Drive…" : logoURL ? visibilityHint : hint}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled || uploading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 16px",
                borderRadius: "9px",
                border: "none",
                background: disabled || uploading ? "var(--border)" : "var(--primary)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: disabled || uploading ? "default" : "pointer",
              }}
            >
              <Camera size={14} />
              {logoURL ? replaceLabel : uploadLabel}
            </button>

            {logoURL && (
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--danger)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: uploading ? "default" : "pointer",
                }}
              >
                <Trash2 size={14} />
                Remove
              </button>
            )}
          </div>

          {error && <div style={{ fontSize: "12px", color: "var(--danger)" }}>{error}</div>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fade-in"
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid rgba(226,232,240,0.8)",
        boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
        padding: "18px 20px",
        marginBottom: "18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
        <Icon size={17} style={{ color: "var(--primary)" }} />
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1a202c" }}>{title}</h3>
      </div>
      {description && (
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "14px" }}>{description}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{children}</div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  saving,
  onChange,
}: {
  icon: any;
  label: string;
  description?: string;
  checked: boolean;
  saving?: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 4px",
        borderBottom: "1px solid var(--border, #edf2f7)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "9px",
          background: checked ? "rgba(26,107,60,0.1)" : "rgba(160,174,192,0.15)",
          color: checked ? "var(--primary)" : "#718096",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a202c" }}>{label}</div>
        {description && (
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>{description}</div>
        )}
      </div>
      <Switch checked={checked} disabled={saving} onChange={onChange} />
    </div>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 42,
        height: 24,
        borderRadius: "999px",
        border: "none",
        background: checked ? "var(--primary)" : "#cbd5e0",
        position: "relative",
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.2s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}
