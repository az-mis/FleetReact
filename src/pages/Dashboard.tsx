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
  AlertTriangle,
  Check,
  ChevronRight,
  TrendingUp,
  Navigation,
  FileCheck2,
  CalendarCheck,
  ShieldAlert,
  Edit3,
} from "lucide-react";
import { USER_ROLE_LABEL, Vehicle, VehicleRequest, AppUser } from "../types";
import { formatTravelDateRange } from "../utils/travelDate";
import LocationFilter from "../components/LocationFilter";
import DashboardCharts from "../components/DashboardCharts";

export default function Dashboard() {
  const { currentUser, profile, role, isAdmin, isSuperAdmin, isDriver } = useAuth();
  const { flags } = useFeatureFlags();

  const [selectedLocation, setSelectedLocation] = useState<string>("");
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

  // Driver query: fetch all trips where the driver is assigned (confirmed or default)
  useEffect(() => {
    if (isDriver && currentUser) {
      const q = query(
        collection(db, "vehicleRequests"),
        where("confirmedDriverId", "==", currentUser.uid)
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest));
          // If defaultDriverId matches but confirmedDriverId is not yet set (or matches default)
          const qDefault = query(
            collection(db, "vehicleRequests"),
            where("defaultDriverId", "==", currentUser.uid)
          );
          onSnapshot(qDefault, (snapDefault) => {
            const defaultList = snapDefault.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest));
            const map = new Map<string, VehicleRequest>();
            list.forEach((r) => map.set(r.id, r));
            defaultList.forEach((r) => {
              // Only include if no different confirmed driver was assigned
              if (!r.confirmedDriverId || r.confirmedDriverId === currentUser.uid) {
                map.set(r.id, r);
              }
            });
            const combined = Array.from(map.values()).sort((a, b) => (b.travelDate || "").localeCompare(a.travelDate || ""));
            setRequests(combined);
          }, (err) => {
            setRequests(list);
          });
        },
        (err) => {
          console.error("Error fetching driver vehicle requests:", err);
        }
      );
      return unsub;
    } else if (isAdmin) {
      const q = query(collection(db, "vehicleRequests"), orderBy("createdAt", "desc"), limit(60));
      const unsub = onSnapshot(q, (snap) =>
        setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest)))
      );
      return unsub;
    }
  }, [isAdmin, isDriver, currentUser]);

  // Regular admins are scoped to their own assigned location (Super Admins see all)
  const adminLocation = !isSuperAdmin ? (profile?.location || "") : "";

  // Scoped datasets based on admin's location (super admins see all or filter by selectedLocation)
  const scopedRequests = useMemo(() => {
    if (!isSuperAdmin && adminLocation) {
      return requests.filter((r) => r.location === adminLocation);
    }
    if (selectedLocation) {
      return requests.filter((r) => r.location === selectedLocation);
    }
    return requests;
  }, [requests, isSuperAdmin, adminLocation, selectedLocation]);

  const scopedVehicles = useMemo(() => {
    if (!isSuperAdmin && adminLocation) {
      return vehicles.filter((v) => v.location === adminLocation);
    }
    if (selectedLocation) {
      return vehicles.filter((v) => v.location === selectedLocation);
    }
    return vehicles;
  }, [vehicles, isSuperAdmin, adminLocation, selectedLocation]);

  const scopedDrivers = useMemo(() => {
    if (!isSuperAdmin && adminLocation) {
      return drivers.filter((d) => d.location === adminLocation);
    }
    if (selectedLocation) {
      return drivers.filter((d) => d.location === selectedLocation);
    }
    return drivers;
  }, [drivers, isSuperAdmin, adminLocation, selectedLocation]);

  // Computed metrics
  const pendingRequests = useMemo(() => scopedRequests.filter((r) => r.status === "pending"), [scopedRequests]);
  const approvedRequests = useMemo(() => scopedRequests.filter((r) => r.status === "approved"), [scopedRequests]);
  const declinedRequests = useMemo(() => scopedRequests.filter((r) => r.status === "declined"), [scopedRequests]);

  const assignedVehiclesCount = useMemo(() => scopedVehicles.filter((v) => v.assignedDriverId).length, [scopedVehicles]);
  const unassignedVehiclesCount = scopedVehicles.length - assignedVehiclesCount;

  const assignedDriversCount = useMemo(() => {
    const ids = new Set(scopedVehicles.map((v) => v.assignedDriverId).filter(Boolean));
    return ids.size;
  }, [scopedVehicles]);

  const recentRequests = useMemo(() => scopedRequests.slice(0, 6), [scopedRequests]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const upcomingTrips = useMemo(() => {
    return scopedRequests
      .filter((r) => r.status === "approved" && (r.travelDate >= todayStr || (r.travelDateEnd && r.travelDateEnd >= todayStr)))
      .sort((a, b) => a.travelDate.localeCompare(b.travelDate))
      .slice(0, 5);
  }, [scopedRequests, todayStr]);

  // Driver-specific KPIs
  const driverMetrics = useMemo(() => {
    if (!isDriver) return null;

    const completed = requests.filter((r) => {
      if (r.status !== "approved") return false;
      const end = r.travelDateEnd || r.travelDate;
      return end < todayStr;
    });

    const activeToday = requests.filter((r) => {
      if (r.status !== "approved") return false;
      const start = r.travelDate;
      const end = r.travelDateEnd || r.travelDate;
      return start <= todayStr && end >= todayStr;
    });

    const future = requests.filter((r) => {
      if (r.status !== "approved") return false;
      const end = r.travelDateEnd || r.travelDate;
      return r.travelDate > todayStr || end >= todayStr;
    });

    // Profile missing fields check
    const missing: string[] = [];
    if (!profile?.photoURL) missing.push("Profile Photo");
    if (!profile?.birthDate) missing.push("Birth Date");
    if (!profile?.address) missing.push("Residential Address");
    if (!profile?.licenseExpirationDate) missing.push("License Expiration Date");

    // License expiry warning
    let licenseStatus: "valid" | "expiring_soon" | "expired" | "none" = "none";
    let daysUntilExpiry: number | null = null;
    if (profile?.licenseExpirationDate) {
      const exp = new Date(profile.licenseExpirationDate);
      const now = new Date(todayStr);
      const diffTime = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysUntilExpiry = diffDays;
      if (diffDays < 0) {
        licenseStatus = "expired";
      } else if (diffDays <= 30) {
        licenseStatus = "expiring_soon";
      } else {
        licenseStatus = "valid";
      }
    }

    return {
      totalAssigned: requests.length,
      completedTrips: completed.length,
      activeTodayCount: activeToday.length,
      futureTripsCount: future.length,
      futureTrips: future.sort((a, b) => a.travelDate.localeCompare(b.travelDate)),
      completedTripsList: completed,
      activeTodayList: activeToday,
      missingFields: missing,
      licenseStatus,
      daysUntilExpiry,
    };
  }, [isDriver, requests, todayStr, profile]);

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
          overflow: "visible",
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

        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
          <div>
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

          {isSuperAdmin && (
            <div style={{ alignSelf: "center" }}>
              <LocationFilter
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            </div>
          )}
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
                sublabel={`${scopedRequests.length} total`}
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
                value={scopedVehicles.length}
                color="var(--info)"
                sublabel={`${assignedVehiclesCount} assigned`}
              />
              <StatCard
                icon={Users}
                label="Total Drivers"
                value={scopedDrivers.length}
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

          {/* Graphical Analytics Section */}
          <DashboardCharts
            requests={scopedRequests}
            vehicles={scopedVehicles}
            drivers={scopedDrivers}
            isSuperAdmin={isSuperAdmin}
            selectedLocation={selectedLocation}
            adminLocation={adminLocation}
          />

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
                      {assignedVehiclesCount} <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>/ {scopedVehicles.length}</span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* 1. Missing Profile Information Alert Banner */}
          {driverMetrics && driverMetrics.missingFields.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "#fffaf0",
                border: "1.5px solid #fbd38d",
                boxShadow: "0 2px 6px rgba(221, 107, 32, 0.08)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: "260px", flex: 1 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "8px",
                    background: "rgba(221, 107, 32, 0.15)",
                    color: "#c05621",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#9c4221" }}>
                    Profile Incomplete ({driverMetrics.missingFields.length} missing {driverMetrics.missingFields.length === 1 ? "item" : "items"})
                  </div>
                  <div style={{ fontSize: "12px", color: "#7b341e", marginTop: "2px", lineHeight: 1.4 }}>
                    Please complete your driver details: <b>{driverMetrics.missingFields.join(", ")}</b>.
                  </div>
                </div>
              </div>
              <Link
                to="/my-profile"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  background: "#dd6b20",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  alignSelf: "center",
                  boxShadow: "0 2px 6px rgba(221, 107, 32, 0.3)",
                }}
              >
                <Edit3 size={13} />
                <span>Complete Profile</span>
              </Link>
            </div>
          )}

          {/* 2. License Status Warning (if expiring soon or expired) */}
          {driverMetrics && driverMetrics.licenseStatus === "expiring_soon" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: "#fffaf0",
                border: "1px solid #fbd38d",
                color: "#c05621",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <Clock size={18} />
              <span>
                Your driver's license will expire in <b>{driverMetrics.daysUntilExpiry} days</b> ({profile?.licenseExpirationDate}). Please prepare your renewal documents.
              </span>
            </div>
          )}

          {driverMetrics && driverMetrics.licenseStatus === "expired" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: "#fff5f5",
                border: "1px solid #feb2b2",
                color: "var(--danger)",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <ShieldAlert size={18} />
              <span>
                Your driver's license expired on <b>{profile?.licenseExpirationDate}</b>. Please contact the administrator.
              </span>
            </div>
          )}

          {/* 3. Driver KPI Stat Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <StatCard
              icon={Navigation}
              label="Completed Travels"
              value={driverMetrics?.completedTrips ?? 0}
              color="var(--primary)"
              sublabel="Past trips finished"
            />
            <StatCard
              icon={CalendarCheck}
              label="Future Assigned Trips"
              value={driverMetrics?.futureTripsCount ?? 0}
              color="var(--info)"
              sublabel="Scheduled ahead"
            />
            <StatCard
              icon={Activity}
              label="Active Trips Today"
              value={driverMetrics?.activeTodayCount ?? 0}
              color="var(--warning)"
              sublabel="Happening now"
            />
            <StatCard
              icon={ClipboardList}
              label="Total Dispatches"
              value={driverMetrics?.totalAssigned ?? 0}
              color="#7e57c2"
              sublabel="All time trips"
            />
          </div>

          {/* 4. Assigned Vehicle Info Card */}
          {flags.driverModules.showAssignedVehicle && (
            assignedVehicle ? (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <Avatar
                    photoURL={assignedVehicle.photoURL}
                    fallback="icon"
                    icon={Car}
                    size={46}
                    name={assignedVehicle.plateNumber}
                  />
                  <div>
                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      My Permanent Assigned Vehicle
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a202c", marginTop: "2px" }}>
                      {assignedVehicle.brand} {assignedVehicle.model} — {assignedVehicle.plateNumber}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Color: <b>{assignedVehicle.color}</b> · Year: <b>{assignedVehicle.year}</b> {assignedVehicle.vehicleType ? `· Type: ${assignedVehicle.vehicleType}` : ""}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "#e6f7ee",
                    color: "var(--primary)",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} /> Ready for Dispatch
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#fff",
                  border: "1px dashed var(--border)",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "var(--text-muted)",
                  fontSize: "12.5px",
                }}
              >
                <Car size={20} />
                <span>No vehicle permanently assigned to you yet. You can still be assigned to individual trip dispatches.</span>
              </div>
            )
          )}

          {/* 5. Main 2-Column Schedule & Travel History */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Left Column: Future / Upcoming Travels */}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CalendarDays size={16} color="var(--info)" />
                  <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                    Future Assigned Travels ({driverMetrics?.futureTripsCount ?? 0})
                  </h3>
                </div>
              </div>

              {(!driverMetrics || driverMetrics.futureTrips.length === 0) ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                  No upcoming scheduled trips.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {driverMetrics.futureTrips.map((trip) => (
                    <div
                      key={trip.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#166534" }}>
                          📍 {trip.destination}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#15803d", marginTop: "2px" }}>
                          Requester: <b>{trip.requesterName}</b> {trip.requesterOffice ? `(${trip.requesterOffice})` : ""}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                          Vehicle: {trip.vehiclePlateNumber} {trip.purpose ? `· Purpose: ${trip.purpose}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#166534" }}>
                          {formatTravelDateRange(trip.travelDate, trip.travelDateEnd)}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            marginTop: "3px",
                            background: "#d9f5e5",
                            color: "#0f7a44",
                          }}
                        >
                          APPROVED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Recent Travel History (Past Travels Made) */}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Navigation size={16} color="var(--primary)" />
                  <h3 style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a202c" }}>
                    Travels Already Made ({driverMetrics?.completedTrips ?? 0})
                  </h3>
                </div>
                <Link
                  to="/travel-history"
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "var(--primary)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  View full history <ChevronRight size={13} />
                </Link>
              </div>

              {(!driverMetrics || driverMetrics.completedTripsList.length === 0) ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                  No completed trips yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {driverMetrics.completedTripsList.slice(0, 6).map((trip) => (
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
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#2d3748" }}>
                          {trip.destination}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                          Passenger: {trip.requesterName} · Plate: {trip.vehiclePlateNumber}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#4a5568" }}>
                          {formatTravelDateRange(trip.travelDate, trip.travelDateEnd)}
                        </div>
                        <span
                          style={{
                            fontSize: "9.5px",
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: "4px",
                            display: "inline-block",
                            marginTop: "2px",
                            background: "#edf2f7",
                            color: "#4a5568",
                          }}
                        >
                          COMPLETED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
