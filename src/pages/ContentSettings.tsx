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
  Database,
  Sparkles,
  Loader2,
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
import { CAR_ANIMATION_STORAGE_KEY, toggleCarAnimation } from "../components/FooterDrivingCar";
import { seed100Records, clearSeededRecords } from "../lib/seeder";

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
  const [confirmReplaceLogoFile, setConfirmReplaceLogoFile] = useState<File | null>(null);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [confirmSwitchDriveOpen, setConfirmSwitchDriveOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearingSeed, setClearingSeed] = useState(false);
  const [seedProgress, setSeedProgress] = useState("");
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const [confirmClearSeedOpen, setConfirmClearSeedOpen] = useState(false);
  const [carAnimationEnabled, setCarAnimationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  });

  // Generic toggle confirmation state
  const [confirmToggleData, setConfirmToggleData] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [toggling, setToggling] = useState(false);

  /** Compresses, uploads to the "FMS Photos" root folder, saves the new URL
   *  to settings/appBranding, and best-effort deletes the old Drive file —
   *  mirrors the photo-save step in Vehicles.tsx/Drivers.tsx, just without
   *  a surrounding form since this is a single always-on setting. */
  async function performLogoUpload(file: File) {
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
      setConfirmReplaceLogoFile(null);
    }
  }

  function handleLogoSelect(file: File) {
    if (branding?.logoURL) {
      setConfirmReplaceLogoFile(file);
    } else {
      performLogoUpload(file);
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



  function handleConnectDriveClick() {
    if (driveConfig) {
      // It's a "Switch account" action - ask for confirmation first
      setConfirmSwitchDriveOpen(true);
    } else {
      performConnectDrive();
    }
  }

  async function performConnectDrive() {
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
      setConfirmSwitchDriveOpen(false);
    }
  }

  function requestToggleAdminModule(key: keyof AdminModuleFlags, label: string) {
    const willEnable = !flags.adminModules[key];
    setConfirmToggleData({
      title: willEnable ? `Enable ${label}?` : `Disable ${label}?`,
      message: willEnable
        ? `Admins will immediately regain access to the ${label} module in the navigation.`
        : `Admins will immediately lose access to the ${label} module in the navigation. (Super Admins retain access).`,
      confirmLabel: willEnable ? "Enable Module" : "Disable Module",
      danger: !willEnable,
      onConfirm: async () => {
        setSavingKey(`admin-${key}`);
        try {
          await updateFlags({ adminModules: { [key]: willEnable } });
          showSuccess("Updated. Admins will see this take effect immediately.");
        } catch (e: any) {
          showError(e.message || "Couldn't save that change.");
        } finally {
          setSavingKey(null);
        }
      },
    });
  }

  function requestToggleDriverModule(key: keyof DriverModuleFlags, label: string) {
    const willEnable = !flags.driverModules[key];
    setConfirmToggleData({
      title: willEnable ? `Enable ${label}?` : `Disable ${label}?`,
      message: willEnable
        ? `Signed-in drivers will now see the ${label} on their dashboard.`
        : `Signed-in drivers will no longer see the ${label} on their dashboard.`,
      confirmLabel: willEnable ? "Enable" : "Disable",
      danger: !willEnable,
      onConfirm: async () => {
        setSavingKey(`driver-${key}`);
        try {
          await updateFlags({ driverModules: { [key]: willEnable } });
          showSuccess("Updated. Drivers will see this take effect immediately.");
        } catch (e: any) {
          showError(e.message || "Couldn't save that change.");
        } finally {
          setSavingKey(null);
        }
      },
    });
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={Settings2}
        title="Content Settings"
        subtitle={
          isSuperAdmin
            ? "Configure media storage, system branding, module visibility, and broadcast announcements."
            : "Control what content is shown to Drivers on their Dashboard."
        }
      />

      {/* Row 1: System Branding & Media Storage */}
      {isSuperAdmin && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "14px",
            marginBottom: "16px",
            alignItems: "stretch",
          }}
        >
          <Section
            icon={HardDrive}
            title="Google Drive"
            description="Cloud storage for user photos, vehicles, and branding assets."
          >
            <DriveConnectionCard
              driveConfig={driveConfig}
              connecting={connectingDrive}
              onConnect={handleConnectDriveClick}
            />
          </Section>

          <Section
            icon={ImageIcon}
            title="App Logo"
            description="Logo shown across sidebar, header, and login screen."
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
        </div>
      )}

      {/* Row 2: Module Visibility & Announcements */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isSuperAdmin ? "repeat(auto-fit, minmax(320px, 1fr))" : "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "14px",
          marginBottom: "16px",
          alignItems: "stretch",
        }}
      >
        {isSuperAdmin && (
          <Section
            icon={ShieldCheck}
            title="Admin Modules"
            description="Toggle navigation access for admin accounts."
          >
            <ToggleRow
              icon={Truck}
              label="Vehicles List"
              description="Vehicle records and details."
              checked={flags.adminModules.vehicles}
              saving={savingKey === "admin-vehicles"}
              onChange={() => requestToggleAdminModule("vehicles", "Vehicles List")}
            />
            <ToggleRow
              icon={UserCog}
              label="Vehicle Assigning"
              description="Permanent driver assignments."
              checked={flags.adminModules.vehicleAssigning}
              saving={savingKey === "admin-vehicleAssigning"}
              onChange={() => requestToggleAdminModule("vehicleAssigning", "Vehicle Assigning")}
            />
            <ToggleRow
              icon={ClipboardList}
              label="Travel Requests"
              description="Reviewing public travel requests."
              checked={flags.adminModules.vehicleRequests}
              saving={savingKey === "admin-vehicleRequests"}
              onChange={() => requestToggleAdminModule("vehicleRequests", "Travel Requests")}
            />
            <ToggleRow
              icon={Users}
              label="Drivers"
              description="Driver profiles and licensing."
              checked={flags.adminModules.drivers}
              saving={savingKey === "admin-drivers"}
              onChange={() => requestToggleAdminModule("drivers", "Drivers")}
            />
          </Section>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Section
            icon={Users}
            title="Driver Dashboard Content"
            description="Controls what signed-in drivers see on dashboard."
          >
            <ToggleRow
              icon={Car}
              label="Assigned Vehicle Card"
              description="Vehicle assigned to the signed-in driver."
              checked={flags.driverModules.showAssignedVehicle}
              saving={savingKey === "driver-showAssignedVehicle"}
              onChange={() => requestToggleDriverModule("showAssignedVehicle", "Assigned Vehicle Card")}
            />
          </Section>

          <Section
            icon={Car}
            title="Visual & UI Effects"
            description="Toggle interactive visual effects across the portal."
          >
            <ToggleRow
              icon={Car}
              label="Footer Driving Car"
              description="Animated SVG vehicle cruising along the bottom of pages."
              checked={carAnimationEnabled}
              saving={false}
              onChange={() => {
                const next = toggleCarAnimation();
                setCarAnimationEnabled(next);
                showSuccess(next ? "Footer car animation enabled." : "Footer car animation hidden.");
              }}
            />
          </Section>

          <AnnouncementSection
            icon={Megaphone}
            title="Driver Announcement"
            description="Broadcast alert banner for driver accounts."
            flagKey="driverAnnouncement"
            config={flags.driverAnnouncement}
            updateFlags={updateFlags}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>

        {isSuperAdmin && (
          <AnnouncementSection
            icon={Megaphone}
            title="Admin Announcement"
            description="Broadcast alert banner for admin accounts."
            flagKey="adminAnnouncement"
            config={flags.adminAnnouncement}
            updateFlags={updateFlags}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
      </div>

      {/* Row 3: Super Admin Database Seeder & Demo Records */}
      {isSuperAdmin && (
        <div style={{ marginBottom: "16px" }}>
          <Section
            icon={Database}
            title="Database Seeder & Demonstration Records"
            description="Generate or clean 100 realistic dummy records for Drivers, Vehicles, and Vehicle Requests (Pending, Approved, Declined) with authentic MIMAROPA locations and assignments."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <Sparkles size={18} style={{ color: "#16a34a", flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "12.5px", color: "#166534", lineHeight: 1.5 }}>
                  <b>100 Sample Data Seeder:</b> Generates 100 Drivers (with Filipino names, license expirations, birthdates), 100 Vehicles (Hilux, Ranger, D-Max, HiAce, etc. with assigned drivers), and 100 Vehicle Requests (mixed: 45 Pending, 40 Approved, 15 Declined) across different date ranges.
                </div>
              </div>

              {seedProgress && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#1e40af",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span>{seedProgress}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={seeding || clearingSeed}
                  onClick={() => setConfirmSeedOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: seeding || clearingSeed ? "#cbd5e1" : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: seeding || clearingSeed ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Database size={15} />
                  {seeding ? "Seeding Records…" : "Seed 100 Sample Records"}
                </button>

                <button
                  type="button"
                  disabled={seeding || clearingSeed}
                  onClick={() => setConfirmClearSeedOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                    color: "var(--danger)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: seeding || clearingSeed ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Trash2 size={15} />
                  {clearingSeed ? "Clearing…" : "Clear Seeded Records"}
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Confirm Seed Dialog */}
      <ConfirmDialog
        open={confirmSeedOpen}
        title="Seed 100 Sample Records?"
        message="This will insert 100 Drivers, 100 Vehicles, and 100 Requests in various statuses (Pending, Approved, Declined) into Firestore. This makes it easy to test pagination, filtering, and role workflows."
        confirmLabel="Start Seeding"
        confirmingLabel="Seeding…"
        danger={false}
        loading={seeding}
        onCancel={() => setConfirmSeedOpen(false)}
        onConfirm={async () => {
          setConfirmSeedOpen(false);
          setSeeding(true);
          try {
            await seed100Records((msg) => setSeedProgress(msg));
            showSuccess("Successfully seeded 100 records!");
          } catch (err: any) {
            showError(err.message || "Failed to seed records.");
          } finally {
            setSeeding(false);
            setSeedProgress("");
          }
        }}
      />

      {/* Confirm Clear Seed Dialog */}
      <ConfirmDialog
        open={confirmClearSeedOpen}
        title="Clear all seeded test records?"
        message="This will delete only dummy records that were tagged as seeded by this tool. Real user accounts and configurations will remain untouched."
        confirmLabel="Clear Dummy Data"
        confirmingLabel="Clearing…"
        danger={true}
        loading={clearingSeed}
        onCancel={() => setConfirmClearSeedOpen(false)}
        onConfirm={async () => {
          setConfirmClearSeedOpen(false);
          setClearingSeed(true);
          try {
            await clearSeededRecords((msg) => setSeedProgress(msg));
            showSuccess("Seeded dummy records successfully removed.");
          } catch (err: any) {
            showError(err.message || "Failed to clear records.");
          } finally {
            setClearingSeed(false);
            setSeedProgress("");
          }
        }}
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

      {/* Confirm Replace Logo */}
      <ConfirmDialog
        open={!!confirmReplaceLogoFile}
        title="Replace app logo?"
        message="Are you sure you want to replace the current app logo with this new image? The previous logo will be overwritten."
        confirmLabel="Replace Logo"
        confirmingLabel="Replacing…"
        danger={false}
        loading={logoUploading}
        onCancel={() => setConfirmReplaceLogoFile(null)}
        onConfirm={() => confirmReplaceLogoFile && performLogoUpload(confirmReplaceLogoFile)}
      />

      {/* Confirm Toggle Modules */}
      <ConfirmDialog
        open={!!confirmToggleData}
        title={confirmToggleData?.title || "Confirm change?"}
        message={confirmToggleData?.message || ""}
        confirmLabel={confirmToggleData?.confirmLabel || "Confirm"}
        confirmingLabel="Updating…"
        danger={confirmToggleData?.danger ?? false}
        loading={toggling}
        onCancel={() => setConfirmToggleData(null)}
        onConfirm={async () => {
          if (!confirmToggleData) return;
          setToggling(true);
          try {
            await confirmToggleData.onConfirm();
          } finally {
            setToggling(false);
            setConfirmToggleData(null);
          }
        }}
      />

      {/* Confirm Switch Google Drive Account */}
      <ConfirmDialog
        open={confirmSwitchDriveOpen}
        title="Switch Google Drive account?"
        message={`Currently connected as ${driveConfig?.connectedByName || "an admin"} (${driveConfig?.connectedByEmail || ""}). Switching accounts will reauthorize Google Drive with a different Google account.`}
        confirmLabel="Switch Account"
        confirmingLabel="Connecting…"
        danger={false}
        loading={connectingDrive}
        onCancel={() => setConfirmSwitchDriveOpen(false)}
        onConfirm={performConnectDrive}
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

  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(config.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.message]);

  async function performToggle() {
    setSavingToggle(true);
    try {
      const next = !config.enabled;
      await updateFlags({ [flagKey]: { enabled: next } });
      showSuccess(next ? "Announcement banner turned on." : "Announcement banner turned off.");
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingToggle(false);
      setConfirmToggleOpen(false);
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

  const audienceLabel = flagKey === "adminAnnouncement" ? "admins" : "drivers";
  const willEnable = !config.enabled;

  return (
    <Section icon={icon} title={title} description={description}>
      <ToggleRow
        icon={Megaphone}
        label="Show banner"
        description={config.enabled ? "Currently visible to audience" : "Currently hidden"}
        checked={config.enabled}
        saving={savingToggle}
        onChange={() => setConfirmToggleOpen(true)}
      />

      <ConfirmDialog
        open={confirmToggleOpen}
        title={willEnable ? `Show ${title.toLowerCase()}?` : `Hide ${title.toLowerCase()}?`}
        message={
          willEnable
            ? `This banner will become immediately visible to all ${audienceLabel}.`
            : `This banner will be hidden from all ${audienceLabel}.`
        }
        confirmLabel={willEnable ? "Show Banner" : "Hide Banner"}
        confirmingLabel="Updating…"
        danger={!willEnable}
        loading={savingToggle}
        onCancel={() => setConfirmToggleOpen(false)}
        onConfirm={performToggle}
      />

      <div style={{ paddingTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Maintenance scheduled for Saturday."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1.5px solid var(--border)",
            fontSize: "12.5px",
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={saveMessage}
            disabled={savingMessage || !dirty}
            style={{
              height: "32px",
              padding: "0 14px",
              borderRadius: "7px",
              border: "none",
              background: dirty ? "linear-gradient(135deg, #00b377 0%, #008f58 100%)" : "var(--border)",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: dirty ? "pointer" : "default",
            }}
          >
            {savingMessage ? "Saving…" : "Save message"}
          </button>
        </div>

        {config.enabled && config.message.trim() && (
          <div style={{ marginTop: "4px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "4px",
              }}
            >
              Live Preview
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                background: "#fffbeb",
                border: "1px solid #fbd38d",
                color: "#7b5b0a",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                lineHeight: 1.4,
              }}
            >
              <Megaphone size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span style={{ whiteSpace: "pre-wrap" }}>{draft.trim() ? draft : config.message}</span>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

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
    <div style={{ paddingTop: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: 72,
            height: 72,
            flexShrink: 0,
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: connected ? "rgba(26,107,60,0.08)" : "rgba(160,174,192,0.1)",
            border: connected ? "1px solid rgba(26,107,60,0.25)" : "1.5px dashed var(--border)",
            color: connected ? "var(--primary)" : "#a0aec0",
          }}
        >
          {connected ? <CheckCircle2 size={32} strokeWidth={1.6} /> : <HardDrive size={28} strokeWidth={1.6} />}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a202c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {connected ? `${driveConfig!.connectedByName}` : "Not connected"}
            </div>
            {connected && driveConfig!.connectedByEmail && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {driveConfig!.connectedByEmail}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              {connected ? (
                <a
                  href={`https://drive.google.com/drive/folders/${driveConfig!.rootFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--primary)" }}
                >
                  Open "FMS Photos" folder <ExternalLink size={11} />
                </a>
              ) : (
                "Connect to enable photo storage."
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: connecting ? "default" : "pointer",
              }}
            >
              <HardDrive size={13} />
              {connected
                ? connecting
                  ? "Reconnecting…"
                  : "Switch account"
                : connecting
                ? "Connecting…"
                : "Connect Drive"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  replaceLabel = "Replace",
  currentLabel = "Current logo",
  hint = "PNG/JPG up to 5MB.",
  visibilityHint = "Visible across the app.",
}: {
  logoURL: string | null;
  uploading: boolean;
  disabled: boolean;
  error?: string;
  onSelect: (file: File) => void;
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
  const tileSize = shape === "wide" ? { width: 100, height: 72 } : { width: 72, height: 72 };

  function openPicker() {
    if (disabled || uploading) return;
    onBeforePick?.();
    inputRef.current?.click();
  }

  return (
    <div style={{ paddingTop: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          onClick={openPicker}
          role="button"
          aria-label={logoURL ? "Change image" : "Upload image"}
          style={{
            position: "relative",
            width: tileSize.width,
            height: tileSize.height,
            flexShrink: 0,
            borderRadius: "14px",
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
                gap: "4px",
                color: "var(--primary)",
              }}
            >
              <ImageIcon size={22} strokeWidth={1.6} />
              <span style={{ fontSize: "9.5px", fontWeight: 600, textAlign: "center", padding: "0 4px", color: "var(--text-muted)" }}>
                {noneLabel}
              </span>
            </div>
          )}

          {!disabled && !uploading && (
            <div
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--primary)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              <Camera size={11} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a202c" }}>
              {logoURL ? currentLabel : noneLabel}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
              {disabled ? "Connect Drive first." : uploading ? "Uploading…" : logoURL ? visibilityHint : hint}
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled || uploading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: disabled || uploading ? "var(--border)" : "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: disabled || uploading ? "default" : "pointer",
              }}
            >
              <Camera size={12} />
              {logoURL ? replaceLabel : uploadLabel}
            </button>

            {logoURL && (
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 10px",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--danger)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: uploading ? "default" : "pointer",
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            )}
          </div>

          {error && <div style={{ fontSize: "11px", color: "var(--danger)" }}>{error}</div>}
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
      style={{
        background: "#fff",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <Icon size={15} style={{ color: "var(--primary)" }} />
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1a202c" }}>{title}</h3>
      </div>
      {description && (
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "10px" }}>{description}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>{children}</div>
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
        gap: "10px",
        padding: "8px 2px",
        borderBottom: "1px solid var(--border, #edf2f7)",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "7px",
          background: checked ? "rgba(26,107,60,0.1)" : "rgba(160,174,192,0.15)",
          color: checked ? "var(--primary)" : "#718096",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1a202c" }}>{label}</div>
        {description && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {description}
          </div>
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
        width: 38,
        height: 22,
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
          left: checked ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}
