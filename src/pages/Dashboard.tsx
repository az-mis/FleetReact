import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import StatCard from "../components/StatCard";
import { Avatar } from "../components/Avatar";
import {
  Truck,
  Users,
  ShieldCheck,
  UserCircle,
  Sparkles,
  ClipboardList,
  Car,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  MapPin,
  ArrowRight,
  User,
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { USER_ROLE_LABEL, Vehicle, VehicleRequest, AppUser } from "../types";
import { formatTravelDateRange } from "../utils/travelDate";

export default function Dashboard() {
  const { currentUser, profile, role, isAdmin, isSuperAdmin, isDriver } = useAuth();
  const { flags } = useFeatureFlags();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);

  // Driver assigned vehicle
  useEffect(() => {
    if (!isDriver || !currentUser || !flags.driverModules.showAssignedVehicle) {
      setAssignedVehicle(null);
      return;
    }
    const q = query(collection(db, "vehicles"), where("assignedDriverId", "==", currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setAssignedVehicle(
          snap.empty ? null : ({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) } as Vehicle)
        ),
      () => setAssignedVehicle(null)
    );
    return unsub;
  }, [isDriver, currentUser, flags.driverModules.showAssignedVehicle]);

  // SuperAdmin: admin accounts count
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["admin"])),
      (snap) => setAdminCount(snap.size)
    );
    return unsub;
  }, [isSuperAdmin]);

  // Admin/SuperAdmin: Drivers stream
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "==", "driver")),
      (snap) => setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AppUser)))
    );
    return unsub;
  }, [isAdmin]);

  // Admin/SuperAdmin: Vehicles stream
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "vehicles"), (snap) =>
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Vehicle)))
    );
    return unsub;
  }, [isAdmin]);

  // All roles: Vehicle Requests stream
  useEffect(() => {
    if (isDriver && currentUser) {
      // Driver sees requests assigned to them
      const q = query(
        collection(db, "vehicleRequests"),
        where("confirmedDriverId", "==", currentUser.uid),
        orderBy("travelDate", "desc"),
        limit(20)
      );
      const unsub = onSnapshot(
        q,
        (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest))),
        (err) => {
          // fallback query without compound index
          const qFallback = query(collection(db, "vehicleRequests"), where("confirmedDriverId", "==", currentUser.uid));
          return onSnapshot(qFallback, (s) =>
            setRequests(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest)))
          );
        }
      );
      return unsub;
    } else if (isAdmin) {
      const q = query(collection(db, "vehicleRequests"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snap) =>
        setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest)))
      );
      return unsub;
    }
  }, [isAdmin, isDriver, currentUser]);

  // Computed metrics
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const approvedRequests = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const declinedRequests = useMemo(() => requests.filter((r) => r.status === "declined"), [requests]);

  const assignedVehiclesCount = useMemo(() => vehicles.filter((v) => v.assignedDriverId).length, [vehicles]);
  const unassignedVehiclesCount = vehicles.length - assignedVehiclesCount;

  const assignedDriversCount = useMemo(() => {
    const ids = new Set(vehicles.map((v) => v.assignedDriverId).filter(Boolean));
    return ids.size;
  }, [vehicles]);

  const recentRequests = useMemo(() => requests.slice(0, 6), [requests]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const upcomingTrips = useMemo(() => {
    return requests
      .filter((r) => r.status === "approved" && (r.travelDate >= todayStr || (r.travelDateEnd && r.travelDateEnd >= todayStr)))
      .sort((a, b) => a.travelDate.localeCompare(b.travelDate))
      .slice(0, 5);
  }, [requests, todayStr]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Hero Welcome Banner */}
      <div
        style={{
          position: "relative",
          borderRadius: "16px",
          padding: "20px 24px",
          background: "linear-gradient(120deg, var(--primary-dark) 0%, var(--primary) 55%, var(--primary-light) 100%)",
          boxShadow: "0 10px 25px -10px rgba(19,77,43,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-40px",
            right: "-20px",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "-50px",
            right: "70px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />

        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: "999px",
              marginBottom: "8px",
              letterSpacing: "0.02em",
            }}
          >
            <Sparkles size={12} />
            {timeGreeting}
          </div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#fff",
              marginBottom: "4px",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome back{profile?.name ? `, ${profile.name}` : ""}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
            <span>
              Signed in as <b style={{ color: "#fff" }}>{role ? USER_ROLE_LABEL[role] : "—"}</b>
            </span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ color: "rgba(255,255,255,0.75)" }}>{today}</span>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Top Key Metrics Grid */}
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "12px",
              }}
            >
              <StatCard
                icon={Clock}
                label="Pending Requests"
                value={pendingRequests.length}
                color="var(--warning)"
                sublabel={`${requests.length} total`}
              />
              <StatCard
                icon={CheckCircle2}
                label="Approved Trips"
                value={approvedRequests.length}
                color="var(--primary)"
              />
              <StatCard
                icon={Truck}
                label="Total Vehicles"
                value={vehicles.length}
                color="var(--info)"
                sublabel={`${assignedVehiclesCount} assigned`}
              />
              <StatCard
                icon={Users}
                label="Total Drivers"
                value={drivers.length}
                color="#7e57c2"
                sublabel={`${assignedDriversCount} active`}
              />
              {isSuperAdmin && (
                <StatCard
                  icon={ShieldCheck}
                  label="Admins"
                  value={adminCount}
                  color="var(--secondary)"
                />
              )}
            </div>
          </section>

          {/* Quick Action Chips */}
          <section
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/vehicle-requests"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                background: pendingRequests.length > 0 ? "rgba(221, 154, 5, 0.12)" : "var(--accent)",
                border: `1px solid ${pendingRequests.length > 0 ? "rgba(221, 154, 5, 0.35)" : "rgba(26, 107, 60, 0.25)"}`,
                color: pendingRequests.length > 0 ? "#9c6b00" : "var(--primary-dark)",
                fontSize: "12px",
                fontWeight: 700,
                transition: "all 0.15s ease",
              }}
            >
              <ClipboardList size={14} />
              <span>Review Requests ({pendingRequests.length})</span>
            </Link>

            <Link
              to="/vehicles"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid var(--border)",
                color: "#2d3748",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <Truck size={14} color="var(--primary)" />
              <span>Manage Vehicles</span>
            </Link>

            <Link
              to="/vehicle-assigning"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid var(--border)",
                color: "#2d3748",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <Users size={14} color="var(--info)" />
              <span>Driver Assignments</span>
            </Link>
          </section>

          {/* Main 2-Column Dashboard Body */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Left Column: Recent Activity & Pending Approvals */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={16} color="var(--primary)" />
                  <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                    Recent Requests
                  </h3>
                </div>
                <Link
                  to="/vehicle-requests"
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  <span>View all</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              {recentRequests.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                  No vehicle requests yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentRequests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: req.status === "pending" ? "#fffcf0" : "#f8fafc",
                        border: `1px solid ${req.status === "pending" ? "#feebc8" : "var(--border)"}`,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "12.5px", color: "#2d3748" }}>
                            {req.requesterName}
                          </span>
                          <span
                            style={{
                              fontSize: "10.5px",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontWeight: 700,
                              background: req.status === "approved" ? "#d9f5e5" : req.status === "pending" ? "#ffe8b3" : "#fdd9d9",
                              color: req.status === "approved" ? "#0f7a44" : req.status === "pending" ? "#8a5a00" : "#a11e1e",
                            }}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span>🚗 {req.vehiclePlateNumber}</span>
                          <span>📍 {req.destination}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
                          {formatTravelDateRange(req.travelDate, req.travelDateEnd)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Upcoming Approved Trips & Fleet Status */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Upcoming Trips Card */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CalendarDays size={16} color="var(--info)" />
                  <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                    Upcoming Approved Trips
                  </h3>
                </div>

                {upcomingTrips.length === 0 ? (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                    No scheduled upcoming trips.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {upcomingTrips.map((trip) => (
                      <div
                        key={trip.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#166534" }}>
                            {trip.destination}
                          </div>
                          <div style={{ fontSize: "11px", color: "#15803d", marginTop: "1px" }}>
                            Driver: <b>{trip.confirmedDriverName || trip.defaultDriverName || "Unassigned"}</b> · {trip.vehiclePlateNumber}
                          </div>
                        </div>
                        <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>
                          {formatTravelDateRange(trip.travelDate, trip.travelDateEnd)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fleet Allocation Summary */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={16} color="var(--primary)" />
                  <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                    Fleet Allocation Status
                  </h3>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Permanently Assigned
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>
                      {assignedVehiclesCount} <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>/ {vehicles.length}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Unassigned Pool
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#4a5568", marginTop: "2px" }}>
                      {unassignedVehiclesCount} <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>vehicles</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Driver Dashboard View */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <UserCircle size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a202c" }}>
                {profile?.name}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                Driver portal: view your assigned vehicle and dispatch schedule.
              </div>
            </div>
          </div>

          {flags.driverModules.showAssignedVehicle && assignedVehicle && (
            <div
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <Avatar
                photoURL={assignedVehicle.photoURL}
                fallback="icon"
                icon={Car}
                size={42}
                name={assignedVehicle.plateNumber}
              />
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  My Assigned Vehicle
                </div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a202c", marginTop: "2px" }}>
                  {assignedVehicle.brand} {assignedVehicle.model} — {assignedVehicle.plateNumber}
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                  Color: {assignedVehicle.color} · Year: {assignedVehicle.year}
                </div>
              </div>
            </div>
          )}

          {/* Driver Trip History / Schedule */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarDays size={16} color="var(--primary)" />
              <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                My Assigned Trips ({requests.length})
              </h3>
            </div>

            {requests.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                No trips have been assigned to you yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {requests.map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#2d3748" }}>
                        {trip.destination}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                        Passenger: {trip.requesterName} {trip.requesterContact ? `(${trip.requesterContact})` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)" }}>
                        {formatTravelDateRange(trip.travelDate, trip.travelDateEnd)}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 5px",
                          borderRadius: "4px",
                          display: "inline-block",
                          marginTop: "2px",
                          background: trip.status === "approved" ? "#d9f5e5" : "#ffe8b3",
                          color: trip.status === "approved" ? "#0f7a44" : "#8a5a00",
                        }}
                      >
                        {trip.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
