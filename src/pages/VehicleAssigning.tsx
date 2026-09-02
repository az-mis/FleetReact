import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useToast } from "../contexts/ToastContext";
import { AppUser, Vehicle } from "../types";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import HeaderSearchInput from "../components/HeaderSearchInput";
import DriverSelect from "../components/DriverSelect";
import Modal from "../components/Modal";
import { UserCog, Truck, CheckCircle2, CircleDashed, Mail, MapPin, BadgeCheck, AlertTriangle } from "lucide-react";
import { Avatar } from "../components/Avatar";

export default function VehicleAssigning() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmUnassign, setConfirmUnassign] = useState<Vehicle | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
      },
      (err) => setError(err.message || "Failed to load vehicles.")
    );
    return unsub;
  }, []);

  useEffect(() => {
    // Reuse the same composite index Drivers.tsx relies on (role == "driver"
    // + orderBy createdAt) instead of orderBy("name"), which would need its
    // own index and was silently failing to return anything. Sort by name
    // on the client instead.
    const q = query(collection(db, "users"), where("role", "==", "driver"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) }));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setDrivers(list);
      },
      (err) => setError(err.message || "Failed to load drivers.")
    );
    return unsub;
  }, []);

  // A driver can be permanently assigned to only one vehicle at a time, so for
  // each vehicle's dropdown we exclude drivers already assigned elsewhere.
  const assignedElsewhere = useMemo(() => {
    const map = new Map<string, string>(); // driverId -> vehicleId
    vehicles.forEach((v) => {
      if (v.assignedDriverId) map.set(v.assignedDriverId, v.id);
    });
    return map;
  }, [vehicles]);

  const assignedCount = useMemo(() => vehicles.filter((v) => v.assignedDriverId).length, [vehicles]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter((v) =>
      [v.plateNumber, v.brand, v.model, v.assignedDriverName].some((f) =>
        (f || "").toLowerCase().includes(s)
      )
    );
  }, [vehicles, search]);

  // Unassigning is one accidental dropdown click away from wiping a real
  // permanent assignment, so it goes through a confirmation step first;
  // picking a driver (including for the first time) doesn't need one, since
  // that's not destructive.
  function requestAssign(vehicle: Vehicle, driverId: string) {
    if (!driverId && vehicle.assignedDriverId) {
      setConfirmUnassign(vehicle);
      return;
    }
    handleAssign(vehicle, driverId);
  }

  async function handleAssign(vehicle: Vehicle, driverId: string) {
    setError("");
    setSavingId(vehicle.id);
    try {
      const driver = driverId ? drivers.find((d) => d.id === driverId) : null;
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        assignedDriverId: driverId || null,
        assignedDriverName: driver ? driver.name : null,
        updatedAt: serverTimestamp(),
      });
      showSuccess(
        driver
          ? `${driver.name} assigned to ${vehicle.plateNumber}.`
          : `Driver unassigned from ${vehicle.plateNumber}.`
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      showError(err.message || `Couldn't update the driver for ${vehicle.plateNumber}.`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={UserCog}
        title="Vehicle Assigning"
        subtitle="Assign each vehicle to one driver permanently."
        actions={
          <div className="header-search-wrap">
            <HeaderSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search plate, brand, driver..."
            />
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <StatCard icon={Truck} label="Total Vehicles" value={vehicles.length} color="var(--primary)" />
        <StatCard icon={CheckCircle2} label="Assigned" value={assignedCount} color="var(--primary-light)" />
        <StatCard icon={CircleDashed} label="Unassigned" value={vehicles.length - assignedCount} color="var(--warning)" />
      </div>

      <div
        style={{
          background: "#eef6ff",
          border: "1px solid #bfdcfa",
          color: "var(--primary-dark)",
          borderRadius: "10px",
          padding: "10px 14px",
          fontSize: "12.5px",
          marginBottom: "18px",
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
        }}
      >
        <UserCog size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Each driver here becomes the permanent, default driver for that vehicle unless they're
          absent. Per-request driver overrides (e.g. when the assigned driver is unavailable) are
          planned for a future update.
        </span>
      </div>

      {error && (
        <div
          style={{
            background: "#fff5f5",
            color: "var(--danger)",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <Truck size={22} style={{ marginBottom: 6 }} />
          <div>No vehicles found.</div>
        </div>
      ) : (
        <div
          className="vehicle-assign-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {filtered.map((v) => (
            <VehicleAssignCard
              key={v.id}
              vehicle={v}
              drivers={drivers}
              assignedElsewhere={assignedElsewhere}
              saving={savingId === v.id}
              onAssign={(driverId) => requestAssign(v, driverId)}
            />
          ))}
        </div>
      )}

      {confirmUnassign && (
        <Modal title="Remove permanent driver?" onClose={() => setConfirmUnassign(null)}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "18px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "#fff8e6",
                color: "var(--warning)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div style={{ fontSize: "13.5px", color: "#2d3748", lineHeight: 1.5 }}>
              <b>{confirmUnassign.assignedDriverName}</b> is currently the permanent driver for{" "}
              <b>{confirmUnassign.plateNumber}</b>. This will unassign them, leaving the vehicle without a
              default driver until someone else is assigned.
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setConfirmUnassign(null)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "#fff",
                color: "#2d3748",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const vehicle = confirmUnassign;
                setConfirmUnassign(null);
                if (vehicle) handleAssign(vehicle, "");
              }}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid var(--danger)",
                background: "var(--danger)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Yes, unassign
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function VehicleAssignCard({
  vehicle,
  drivers,
  assignedElsewhere,
  saving,
  onAssign,
}: {
  vehicle: Vehicle;
  drivers: AppUser[];
  assignedElsewhere: Map<string, string>;
  saving: boolean;
  onAssign: (driverId: string) => void;
}) {
  const assignedDriver = drivers.find((d) => d.id === vehicle.assignedDriverId) || null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          borderTopLeftRadius: "14px",
          borderTopRightRadius: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          background: vehicle.assignedDriverId ? undefined : "#fffaf0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <Avatar photoURL={vehicle.photoURL} fallback="icon" icon={Truck} size={40} name={vehicle.plateNumber} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {vehicle.plateNumber}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {vehicle.brand} {vehicle.model}
            </div>
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: "11.5px",
            fontWeight: 700,
            padding: "5px 12px",
            borderRadius: "999px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            background: vehicle.assignedDriverId ? "#d9f5e5" : "#ffe8b3",
            color: vehicle.assignedDriverId ? "#0f7a44" : "#8a5a00",
            border: `1px solid ${vehicle.assignedDriverId ? "#a9e6c4" : "#ffcf66"}`,
          }}
        >
          {vehicle.assignedDriverId ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
          {vehicle.assignedDriverId ? "Assigned" : "Unassigned"}
        </span>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>
            PERMANENT DRIVER
          </span>
          <DriverSelect
            value={vehicle.assignedDriverId || ""}
            disabled={saving}
            onChange={(driverId) => onAssign(driverId)}
            placeholder="— Unassigned —"
            options={drivers
              .filter((d) => {
                const takenBy = assignedElsewhere.get(d.id);
                return !takenBy || takenBy === vehicle.id;
              })
              .map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>

        {saving ? (
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Saving...</div>
        ) : assignedDriver ? (
          <DriverInfo driver={assignedDriver} />
        ) : (
          <div
            style={{
              fontSize: "12.5px",
              color: "var(--text-muted)",
              border: "1px dashed var(--border)",
              borderRadius: "8px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            No driver assigned yet.
          </div>
        )}
      </div>
    </div>
  );
}

function DriverInfo({ driver }: { driver: AppUser | null }) {
  if (!driver) {
    // Assigned driver's profile isn't loaded yet (or was removed) — avoid
    // showing stale/blank info.
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        background: "#f7fafc",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "10px",
      }}
    >
      <Avatar photoURL={driver.photoURL} name={driver.name || driver.email} size={34} />
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, fontSize: "12px", color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#2d3748" }}>{driver.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mail size={12} style={{ flexShrink: 0 }} /> {driver.email}
        </span>
        {driver.address && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MapPin size={12} style={{ flexShrink: 0 }} /> {driver.address}
          </span>
        )}
        {driver.licenseExpirationDate && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <BadgeCheck size={12} style={{ flexShrink: 0 }} /> License exp: {driver.licenseExpirationDate}
          </span>
        )}
      </div>
    </div>
  );
}
