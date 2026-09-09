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
import { useAuth } from "../contexts/AuthContext";

import { AppUser, Vehicle } from "../types";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import HeaderSearchInput from "../components/HeaderSearchInput";
import DriverSelect from "../components/DriverSelect";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import { UserCog, Truck, CheckCircle2, CircleDashed, Mail, MapPin, BadgeCheck, AlertTriangle } from "lucide-react";
import { Avatar } from "../components/Avatar";

export default function VehicleAssigning() {
  const { isSuperAdmin, profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmUnassign, setConfirmUnassign] = useState<Vehicle | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{ vehicle: Vehicle; driverId: string; driverName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const { showSuccess, showError } = useToast();

  // Regular admins are scoped to their own assigned location
  const adminLocation = !isSuperAdmin ? (profile?.location || "") : "";

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

  // Scope vehicles and drivers to admin's location (super admins see all)
  const scopedVehicles = useMemo(
    () => (adminLocation ? vehicles.filter((v) => v.location === adminLocation) : vehicles),
    [vehicles, adminLocation]
  );

  const scopedDrivers = useMemo(
    () => (adminLocation ? drivers.filter((d) => d.location === adminLocation) : drivers),
    [drivers, adminLocation]
  );

  // A driver can be permanently assigned to only one vehicle at a time, so for
  // each vehicle's dropdown we exclude drivers already assigned elsewhere.
  const assignedElsewhere = useMemo(() => {
    const map = new Map<string, string>(); // driverId -> vehicleId
    scopedVehicles.forEach((v) => {
      if (v.assignedDriverId) map.set(v.assignedDriverId, v.id);
    });
    return map;
  }, [scopedVehicles]);

  const assignedCount = useMemo(() => scopedVehicles.filter((v) => v.assignedDriverId).length, [scopedVehicles]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return scopedVehicles;
    return scopedVehicles.filter((v) =>
      [v.plateNumber, v.brand, v.model, v.assignedDriverName].some((f) =>
        (f || "").toLowerCase().includes(s)
      )
    );
  }, [scopedVehicles, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function requestAssign(vehicle: Vehicle, driverId: string) {
    if (!driverId && vehicle.assignedDriverId) {
      setConfirmUnassign(vehicle);
      return;
    }
    if (driverId && driverId !== vehicle.assignedDriverId) {
      const targetDriver = scopedDrivers.find((d) => d.id === driverId);
      setPendingAssignment({
        vehicle,
        driverId,
        driverName: targetDriver ? targetDriver.name : "Selected Driver",
      });
      return;
    }
    handleAssign(vehicle, driverId);
  }

  async function handleAssign(vehicle: Vehicle, driverId: string) {
    setError("");
    setSavingId(vehicle.id);
    try {
      const driver = driverId ? scopedDrivers.find((d) => d.id === driverId) : null;
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
        <StatCard icon={Truck} label="Total Vehicles" value={scopedVehicles.length} color="var(--primary)" />
        <StatCard icon={CheckCircle2} label="Assigned" value={assignedCount} color="var(--primary-light)" />
        <StatCard icon={CircleDashed} label="Unassigned" value={scopedVehicles.length - assignedCount} color="var(--warning)" />
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
            padding: "28px",
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
            gap: "12px",
          }}
        >
          {paginated.map((v) => (
            <VehicleAssignCard
              key={v.id}
              vehicle={v}
              drivers={scopedDrivers}
              assignedElsewhere={assignedElsewhere}
              saving={savingId === v.id}
              onAssign={(driverId) => requestAssign(v, driverId)}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48, 96]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="vehicles"
        />
      )}

      {confirmUnassign && (
        <Modal title="Remove permanent driver?" onClose={() => setConfirmUnassign(null)}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "8px",
                background: "#fff8e6",
                color: "var(--warning)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={16} />
            </div>
            <div style={{ fontSize: "13px", color: "#2d3748", lineHeight: 1.5 }}>
              <b>{confirmUnassign.assignedDriverName}</b> is currently the permanent driver for{" "}
              <b>{confirmUnassign.plateNumber}</b>. This will unassign them, leaving the vehicle without a
              default driver until someone else is assigned.
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              onClick={() => setConfirmUnassign(null)}
              style={{
                padding: "8px 14px",
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
                padding: "8px 14px",
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

      {pendingAssignment && (
        <Modal title="Confirm Driver Assignment?" onClose={() => setPendingAssignment(null)}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "8px",
                background: "#e6fffa",
                color: "#0f7a44",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div style={{ fontSize: "13px", color: "#2d3748", lineHeight: 1.5 }}>
              Assign <b>{pendingAssignment.driverName}</b> as the permanent driver for{" "}
              <b>{pendingAssignment.vehicle.plateNumber}</b> ({pendingAssignment.vehicle.brand}{" "}
              {pendingAssignment.vehicle.model})?
              {pendingAssignment.vehicle.assignedDriverName && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                  (This will replace currently assigned driver <b>{pendingAssignment.vehicle.assignedDriverName}</b>)
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              onClick={() => setPendingAssignment(null)}
              style={{
                padding: "8px 14px",
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
                const { vehicle, driverId } = pendingAssignment;
                setPendingAssignment(null);
                handleAssign(vehicle, driverId);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 179, 119, 0.28)",
              }}
            >
              Confirm Assignment
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
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          background: vehicle.assignedDriverId ? undefined : "#fffaf0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <Avatar photoURL={vehicle.photoURL} fallback="icon" icon={Truck} size={36} name={vehicle.plateNumber} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {vehicle.plateNumber}
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {vehicle.brand} {vehicle.model}
            </div>
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: "999px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.2px",
            background: vehicle.assignedDriverId ? "#d9f5e5" : "#ffe8b3",
            color: vehicle.assignedDriverId ? "#0f7a44" : "#8a5a00",
            border: `1px solid ${vehicle.assignedDriverId ? "#a9e6c4" : "#ffcf66"}`,
          }}
        >
          {vehicle.assignedDriverId ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
          {vehicle.assignedDriverId ? "Assigned" : "Unassigned"}
        </span>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#4a5568" }}>
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
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Saving...</div>
        ) : assignedDriver ? (
          <DriverInfo driver={assignedDriver} />
        ) : (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              border: "1px dashed var(--border)",
              borderRadius: "8px",
              padding: "8px 10px",
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
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        background: "#f7fafc",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "8px 10px",
      }}
    >
      <Avatar photoURL={driver.photoURL} name={driver.name || driver.email} size={32} />
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 700, fontSize: "12.5px", color: "#2d3748" }}>{driver.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mail size={11} style={{ flexShrink: 0 }} /> {driver.email}
        </span>
        {driver.address && (
          <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MapPin size={11} style={{ flexShrink: 0 }} /> {driver.address}
          </span>
        )}
        {driver.licenseExpirationDate && (
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <BadgeCheck size={11} style={{ flexShrink: 0 }} /> Exp: {driver.licenseExpirationDate}
          </span>
        )}
      </div>
    </div>
  );
}
