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
import { Search, UserCog, Truck, CheckCircle2, CircleDashed, Mail, MapPin, BadgeCheck } from "lucide-react";

export default function VehicleAssigning() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
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
          <div style={{ position: "relative", flex: "0 1 260px", minWidth: "180px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 9, color: "var(--text-muted)" }} />
            <input
              placeholder="Search plate, brand, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 10px 8px 32px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                width: "100%",
                background: "rgba(255,255,255,0.92)",
              }}
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
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
              onAssign={(driverId) => handleAssign(v, driverId)}
            />
          ))}
        </div>
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
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: "var(--accent)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Truck size={18} />
          </div>
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
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: "999px",
            background: vehicle.assignedDriverId ? "#e6f7ee" : "#fff8e6",
            color: vehicle.assignedDriverId ? "var(--primary)" : "var(--warning)",
          }}
        >
          {vehicle.assignedDriverId ? "Assigned" : "Unassigned"}
        </span>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>
            PERMANENT DRIVER
          </span>
          <select
            value={vehicle.assignedDriverId || ""}
            disabled={saving}
            onChange={(e) => onAssign(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "13px",
              width: "100%",
              background: saving ? "#f7fafc" : "#fff",
            }}
          >
            <option value="">— Unassigned —</option>
            {drivers
              .filter((d) => {
                const takenBy = assignedElsewhere.get(d.id);
                return !takenBy || takenBy === vehicle.id;
              })
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>

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
  const initial = (driver.name || driver.email || "?")[0]?.toUpperCase();

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
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
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
