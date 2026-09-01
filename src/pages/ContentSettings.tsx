import React, { useState } from "react";
import {
  Settings2,
  Truck,
  UserCog,
  ClipboardList,
  Users,
  Megaphone,
  ShieldCheck,
  Car,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import { AdminModuleFlags, DriverModuleFlags } from "../types";

export default function ContentSettings() {
  const { isSuperAdmin } = useAuth();
  const { flags, loading, updateFlags } = useFeatureFlags();
  const { showSuccess, showError } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Announcement text is edited locally and only pushed to Firestore on
  // "Save", so the admin isn't writing on every keystroke; the toggles
  // below save immediately since there's nothing to type.
  const [announcementDraft, setAnnouncementDraft] = useState(flags.announcement.message);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  React.useEffect(() => {
    if (!draftDirty) setAnnouncementDraft(flags.announcement.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.announcement.message]);

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

  async function toggleAnnouncementEnabled() {
    setSavingKey("announcement-enabled");
    try {
      await updateFlags({ announcement: { enabled: !flags.announcement.enabled } });
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleAudience(who: "admin" | "driver") {
    const audience = flags.announcement.audience.includes(who)
      ? flags.announcement.audience.filter((a) => a !== who)
      : [...flags.announcement.audience, who];
    setSavingKey(`audience-${who}`);
    try {
      await updateFlags({ announcement: { audience } });
    } catch (e: any) {
      showError(e.message || "Couldn't save that change.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveAnnouncementMessage() {
    setSavingAnnouncement(true);
    try {
      await updateFlags({ announcement: { message: announcementDraft } });
      setDraftDirty(false);
      showSuccess("Announcement saved.");
    } catch (e: any) {
      showError(e.message || "Couldn't save the announcement.");
    } finally {
      setSavingAnnouncement(false);
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
        icon={ShieldCheck}
        title="Admin modules"
        description="Turn these off to hide the page from the sidebar and block direct navigation — for the admin role only. Super admins always keep full access."
      >
        <ToggleRow
          icon={Truck}
          label="Vehicle Information"
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
        <ToggleRow
          icon={Megaphone}
          label="Announcement banner"
          description={
            isSuperAdmin
              ? "Whether drivers can see the announcement banner below, when it's on."
              : "Whether drivers can see the announcement banner, when a super admin turns it on."
          }
          checked={flags.driverModules.showAnnouncement}
          saving={savingKey === "driver-showAnnouncement"}
          onChange={() => toggleDriverModule("showAnnouncement")}
        />
      </Section>

      {isSuperAdmin && (
      <Section
        icon={Megaphone}
        title="Announcement banner"
        description="A message shown at the top of the Dashboard for the audience you pick below. Super admins always see it too, regardless of audience, so you can confirm it went out."
      >
        <ToggleRow
          icon={Megaphone}
          label="Show announcement banner"
          description={flags.announcement.enabled ? "Currently visible to the selected audience." : "Currently hidden."}
          checked={flags.announcement.enabled}
          saving={savingKey === "announcement-enabled"}
          onChange={toggleAnnouncementEnabled}
        />

        <div style={{ display: "flex", gap: "18px", padding: "10px 4px", flexWrap: "wrap" }}>
          <AudienceCheckbox
            label="Admins"
            checked={flags.announcement.audience.includes("admin")}
            saving={savingKey === "audience-admin"}
            onChange={() => toggleAudience("admin")}
          />
          <AudienceCheckbox
            label="Drivers"
            checked={flags.announcement.audience.includes("driver")}
            saving={savingKey === "audience-driver"}
            onChange={() => toggleAudience("driver")}
          />
        </div>

        <div style={{ padding: "4px" }}>
          <textarea
            value={announcementDraft}
            onChange={(e) => {
              setAnnouncementDraft(e.target.value);
              setDraftDirty(true);
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
              onClick={saveAnnouncementMessage}
              disabled={savingAnnouncement || !draftDirty}
              style={{
                padding: "9px 18px",
                borderRadius: "9px",
                border: "none",
                background: draftDirty ? "var(--primary)" : "var(--border)",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: draftDirty ? "pointer" : "default",
              }}
            >
              {savingAnnouncement ? "Saving…" : "Save message"}
            </button>
          </div>
        </div>
      </Section>
      )}
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

function AudienceCheckbox({
  label,
  checked,
  saving,
  onChange,
}: {
  label: string;
  checked: boolean;
  saving?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        color: "#2d3748",
        cursor: saving ? "default" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}
    >
      <input type="checkbox" checked={checked} disabled={saving} onChange={onChange} style={{ width: 16, height: 16 }} />
      {label}
    </label>
  );
}
