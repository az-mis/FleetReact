import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppUser, Vehicle, VehicleRequest, VehicleRequestStatus } from "../types";
import { formatTravelDateRange, dateRangesOverlap } from "../utils/travelDate";
import { buildTripTicketNumber, getLocationCode } from "../utils/ticketNumber";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Pagination from "../components/Pagination";
import { Avatar } from "../components/Avatar";
import LocationFilter from "../components/LocationFilter";
import {
  ClipboardList,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  CalendarDays,
  FileText,
  Phone,
  Building2,
  Users,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Pencil,
  LucideIcon,
} from "lucide-react";

const STATUS_BADGE_STYLE: Record<VehicleRequestStatus, { bg: string; border: string; color: string; icon: LucideIcon }> = {
  pending: { bg: "#ffe8b3", border: "#ffcf66", color: "#8a5a00", icon: Clock },
  approved: { bg: "#d9f5e5", border: "#a9e6c4", color: "#0f7a44", icon: CheckCircle2 },
  declined: { bg: "#fdd9d9", border: "#f7b8b8", color: "#a11e1e", icon: XCircle },
};

export default function VehicleRequests() {
  const { profile, currentUser, isSuperAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleRequestStatus | "all">("pending");
  const [reviewing, setReviewing] = useState<VehicleRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const q = query(collection(db, "vehicleRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleRequest, "id">) })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) }));
      setDrivers(all.filter((u) => u.role === "driver"));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("plateNumber"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  // Location-scoped requests: Super Admins see all requests (or filter by selectedLocation);
  // Admins assigned to a specific Location see only requests originating from that location.
  const visibleRequests = useMemo(() => {
    if (profile?.role === "admin" && profile?.location) {
      return requests.filter((r) => r.location === profile.location);
    }
    if (selectedLocation) {
      return requests.filter((r) => r.location === selectedLocation);
    }
    return requests;
  }, [requests, profile, selectedLocation]);

  const counts = useMemo(
    () => ({
      total: visibleRequests.length,
      pending: visibleRequests.filter((r) => r.status === "pending").length,
      approved: visibleRequests.filter((r) => r.status === "approved").length,
      declined: visibleRequests.filter((r) => r.status === "declined").length,
    }),
    [visibleRequests]
  );

  const filtered = useMemo(() => {
    let list = visibleRequests;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((r) => {
        const passList = [
          ...(r.requesterIsPassenger ? [r.requesterName] : []),
          ...(r.passengers || []),
        ];
        return [
          r.requesterName,
          r.vehiclePlateNumber,
          r.destination,
          r.defaultDriverName,
          r.location,
          ...passList,
        ].some((f) => (f || "").toLowerCase().includes(s));
      });
    }
    return list;
  }, [visibleRequests, statusFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, selectedLocation]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Drivers already committed to an *approved* request whose date range
  // overlaps this one are flagged as busy — a basic conflict check for
  // substitution. Uses range overlap (not exact-date match) so multi-day
  // trips are caught too.
  function busyDriverIds(travelDate: string, travelDateEnd: string | null | undefined, excludeRequestId: string) {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.id === excludeRequestId) return;
      if (r.status !== "approved") return;
      if (!dateRangesOverlap(travelDate, travelDateEnd, r.travelDate, r.travelDateEnd)) return;
      if (r.confirmedDriverId) set.add(r.confirmedDriverId);
    });
    return set;
  }

  // A vehicle can't physically be in two places at once — true regardless of
  // which driver is behind the wheel. True when this exact plate is already
  // committed to a *different*, already-approved request whose date range
  // overlaps this one.
  function isVehicleDoubleBooked(
    vehiclePlateNumber: string,
    travelDate: string,
    travelDateEnd: string | null | undefined,
    excludeRequestId: string
  ) {
    return requests.some((r) => {
      if (r.id === excludeRequestId) return false;
      if (r.status !== "approved") return false;
      if (r.vehiclePlateNumber !== vehiclePlateNumber) return false;
      return dateRangesOverlap(travelDate, travelDateEnd, r.travelDate, r.travelDateEnd);
    });
  }

  async function handleDecline(request: VehicleRequest, reason: string) {
    try {
      await updateDoc(doc(db, "vehicleRequests", request.id), {
        status: "declined",
        declineReason: reason || null,
        approvedBy: currentUser?.uid || null,
        approvedByName: profile?.name || null,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // A declined trip no longer occupies the vehicle's calendar. Deleting
      // a doc that doesn't exist (e.g. it was never mirrored) is a no-op in
      // Firestore, so this is safe to call unconditionally.
      try {
        await deleteDoc(doc(db, "vehicleAvailability", request.id));
      } catch (availErr) {
        console.error("Couldn't remove vehicleAvailability mirror:", availErr);
      }
      showSuccess(`Request from ${request.requesterName} declined.`);
      setReviewing(null);
    } catch (err: any) {
      showError(err.message || "Couldn't decline this request.");
    }
  }

  async function handleApprove(request: VehicleRequest, driverId: string, driverName: string) {
    try {
      let s1Name = profile?.signee1Name || null;
      let s1Title = profile?.signee1Title || null;
      let s2Name = profile?.signee2Name || null;
      let s2Title = profile?.signee2Title || null;

      if (currentUser?.uid) {
        try {
          const uSnap = await getDoc(doc(db, "users", currentUser.uid));
          if (uSnap.exists()) {
            const uData = uSnap.data() as AppUser;
            if (uData.signee1Name) s1Name = uData.signee1Name;
            if (uData.signee1Title) s1Title = uData.signee1Title;
            if (uData.signee2Name) s2Name = uData.signee2Name;
            if (uData.signee2Title) s2Title = uData.signee2Title;
          }
        } catch (e) {
          console.error("Error fetching approver user doc:", e);
        }
      }

      if ((!s1Name || !s2Name) && request.location) {
        try {
          const q = query(
            collection(db, "users"),
            where("role", "==", "admin"),
            where("location", "==", request.location)
          );
          const locAdmins = await getDocs(q);
          if (!locAdmins.empty) {
            const adminData = locAdmins.docs[0].data() as AppUser;
            if (!s1Name && adminData.signee1Name) s1Name = adminData.signee1Name;
            if (!s1Title && adminData.signee1Title) s1Title = adminData.signee1Title;
            if (!s2Name && adminData.signee2Name) s2Name = adminData.signee2Name;
            if (!s2Title && adminData.signee2Title) s2Title = adminData.signee2Title;
          }
        } catch (e) {
          console.error("Error fetching location admin signatories:", e);
        }
      }

      // ── Generate sequential trip ticket number ──────────────────────────
      // Only generate a new one if this request doesn't already have one
      // (re-approval edge case). The number is sequential per location+month.
      let ticketNo = request.tripTicketNumber || "";
      if (!ticketNo) {
        const now = new Date();
        const locCode = getLocationCode(request.location);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const prefix = `FMS-${locCode}-${year}-${month}-`;

        // Count how many trip tickets already exist with this prefix.
        // tripTicketNumber is only ever set at approval time so no need to
        // also filter by status — that would require a composite Firestore
        // index and cause the query to throw, falling through to the fallback.
        const existingSnap = await getDocs(
          query(
            collection(db, "vehicleRequests"),
            where("tripTicketNumber", ">=", prefix),
            where("tripTicketNumber", "<", prefix + "\uf8ff")
          )
        );
        const nextSeq = existingSnap.size + 1;
        ticketNo = buildTripTicketNumber(locCode, now, nextSeq);
      }

      await updateDoc(doc(db, "vehicleRequests", request.id), {
        status: "approved",
        tripTicketNumber: ticketNo,
        confirmedDriverId: driverId || null,
        confirmedDriverName: driverName || null,
        approvedBy: currentUser?.uid || null,
        approvedByName: profile?.name || null,
        signee1Name: s1Name,
        signee1Title: s1Title,
        signee2Name: s2Name,
        signee2Title: s2Title,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // setDoc (not updateDoc) since a mirror doc might not exist yet for
      // older requests submitted before this feature — this both creates
      // and updates as needed.
      try {
        await setDoc(doc(db, "vehicleAvailability", request.id), {
          vehicleId: request.vehicleId,
          travelDate: request.travelDate,
          travelDateEnd: request.travelDateEnd ?? null,
          status: "approved",
        });
      } catch (availErr) {
        console.error("Couldn't update vehicleAvailability mirror:", availErr);
      }
      showSuccess(`Request from ${request.requesterName} approved.`);
      setReviewing(null);
    } catch (err: any) {
      showError(err.message || "Couldn't approve this request.");
    }
  }

  async function handleUpdateDriver(request: VehicleRequest, driverId: string, driverName: string) {
    try {
      await updateDoc(doc(db, "vehicleRequests", request.id), {
        confirmedDriverId: driverId || null,
        confirmedDriverName: driverName || null,
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Assigned driver updated to ${driverName || "Unassigned"}.`);
      setReviewing(null);
    } catch (err: any) {
      showError(err.message || "Couldn't update driver for this request.");
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={ClipboardList}
        title="Travel Requests"
        subtitle="Review and confirm staff travel requests submitted via QR code."
        actions={
          <>
            <div className="header-search-wrap">
              <HeaderSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search requester, plate, destination..."
              />
            </div>
            {isSuperAdmin && (
              <LocationFilter
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            )}
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <StatCard icon={ClipboardList} label="Total Requests" value={counts.total} color="#4a5568" />
        <StatCard icon={Clock} label="Pending" value={counts.pending} color="var(--warning)" />
        <StatCard icon={CheckCircle2} label="Approved" value={counts.approved} color="var(--primary)" />
        <StatCard icon={XCircle} label="Declined" value={counts.declined} color="var(--danger)" />
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
        {(["pending", "approved", "declined", "all"] as const).map((s) => {
          const count =
            s === "all"
              ? counts.total
              : counts[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                border: statusFilter === s ? "none" : "1px solid var(--border)",
                background: statusFilter === s ? "var(--primary)" : "#fff",
                color: statusFilter === s ? "#fff" : "#4a5568",
                fontSize: "12.5px",
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
                boxShadow: statusFilter === s ? "0 2px 8px rgba(26, 107, 60, 0.25)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{s}</span>
              <span
                style={{
                  fontSize: "10.5px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: statusFilter === s ? "rgba(255,255,255,0.25)" : "#edf2f7",
                  color: statusFilter === s ? "#fff" : "#718096",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--text-muted)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#f7fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              color: "#a0aec0",
            }}
          >
            <ClipboardList size={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#2d3748" }}>No requests found</div>
          <div style={{ fontSize: "12.5px", color: "#718096", marginTop: "4px" }}>
            {search ? "Try refining your search keyword or clearing filters." : "Requests submitted by staff will appear here."}
          </div>
        </div>
      ) : (
        <>
          {/* Responsive Card Layout for Mobile & Compact Screens */}
          <div className="mobile-requests-grid">
            {filtered.map((r) => {
              const vehicle = vehicles.find((v) => v.id === requestVehicleId(r));
              const driverName =
                r.status === "approved"
                  ? r.confirmedDriverName || "Unassigned"
                  : r.defaultDriverName || "Not assigned";
              const driverId = r.status === "approved" ? r.confirmedDriverId : r.defaultDriverId;
              const driver = drivers.find((d) => d.id === driverId);
              const badge = STATUS_BADGE_STYLE[r.status];
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={r.id}
                  style={{
                    background: "#fff",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Header: Destination & Status Badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#1a202c", display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                      <span style={{ color: "var(--primary)" }}>📍</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.destination}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                      {r.tripTicketNumber && (
                        <span
                          title="Trip Ticket No. — click to copy"
                          onClick={() => navigator.clipboard?.writeText(r.tripTicketNumber!)}
                          style={{
                            fontFamily: "monospace",
                            fontSize: "9.5px",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            background: "#f0fdf4",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                            borderRadius: "5px",
                            padding: "2px 6px",
                            cursor: "pointer",
                            userSelect: "all",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.tripTicketNumber}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "9.5px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3.5px",
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <BadgeIcon size={9} />
                        {r.status}
                      </span>
                    </div>
                  </div>

                  {/* Trip Date, Vehicle & Location Info Box */}
                  <div
                    style={{
                      fontSize: "11.5px",
                      background: "#f8fafc",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #edf2f7",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, color: "#2d3748", fontSize: "11.5px" }}>
                        🗓 {formatTravelDateRange(r.travelDate, r.travelDateEnd)}
                      </div>
                      <div style={{ fontWeight: 800, color: "var(--primary-dark)", fontSize: "11.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Truck size={13} /> {r.vehiclePlateNumber}
                        {r.location && (
                          <span style={{ color: "#718096", fontWeight: 600, fontSize: "11px", marginLeft: "4px" }}>
                            • {r.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {r.purpose && (
                      <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Purpose: {r.purpose}
                      </div>
                    )}
                  </div>

                  {/* Requester & Driver Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                        Requester
                      </div>
                      <div style={{ fontWeight: 600, color: "#2d3748", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.requesterName}
                      </div>
                      {r.requesterOffice && (
                        <div style={{ fontSize: "10px", color: "#718096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.requesterOffice}
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                        Driver
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <Avatar photoURL={driver?.photoURL} name={driverName} size={18} />
                        <span style={{ fontWeight: 600, color: "#2d3748", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {driverName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Passengers Section */}
                  {((r.passengers && r.passengers.length > 0) || r.requesterIsPassenger) && (
                    <div style={{ fontSize: "11px", borderTop: "1px dashed #edf2f7", paddingTop: "5px" }}>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "2px" }}>
                        Passengers
                      </div>
                      <PassengersCell request={r} />
                    </div>
                  )}

                  {/* Approver Tag */}
                  {r.approvedByName && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#166534", fontWeight: 600 }}>
                      <ShieldCheck size={11} color="#166534" />
                      <span>Approved by: {r.approvedByName}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => setReviewing(r)}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: r.status === "pending" ? "linear-gradient(135deg, #00b377 0%, #008f58 100%)" : "#edf2f7",
                      color: r.status === "pending" ? "#fff" : "#2d3748",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: r.status === "pending" ? "0 2px 4px rgba(0, 179, 119, 0.2)" : "none",
                      marginTop: "2px",
                    }}
                  >
                    {r.status === "pending" ? "Review Request" : "View Details"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Table View for Desktop / Large Screens */}
          <div className="desktop-requests-table auth-table-wrap">
            <table className="auth-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Vehicle</th>
                  <th style={{ minWidth: 110 }}>Trip No.</th>
                  <th style={{ minWidth: 130 }}>Plate &amp; Travel Date</th>
                  <th style={{ minWidth: 130 }}>Office Province</th>
                  <th style={{ minWidth: 140 }}>Driver</th>
                  <th style={{ minWidth: 150 }}>Requester</th>
                  <th style={{ minWidth: 160 }}>Passengers</th>
                  <th style={{ minWidth: 140 }}>Destination</th>
                  <th style={{ minWidth: 130 }}>Purpose</th>
                  <th style={{ minWidth: 100 }}>Status</th>
                  <th style={{ minWidth: 130 }}>Approver</th>
                  <th style={{ textAlign: "right", minWidth: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const vehicle = vehicles.find((v) => v.id === requestVehicleId(r));
                  const driverName =
                    r.status === "approved"
                      ? r.confirmedDriverName || "Unassigned"
                      : r.defaultDriverName || "Not assigned";
                  const driverId = r.status === "approved" ? r.confirmedDriverId : r.defaultDriverId;
                  const driver = drivers.find((d) => d.id === driverId);
                  const badge = STATUS_BADGE_STYLE[r.status];
                  const BadgeIcon = badge.icon;

                  return (
                    <tr key={r.id} className="admin-row">
                      {/* 1. Vehicle Pic */}
                      <td style={{ width: 48, paddingRight: 0 }}>
                        <Avatar
                          photoURL={vehicle?.photoURL}
                          fallback="icon"
                          icon={Truck}
                          size={34}
                          name={r.vehiclePlateNumber}
                        />
                      </td>

                      {/* 1b. Trip Ticket Number */}
                      <td>
                        {r.tripTicketNumber ? (
                          <span
                            title="Trip Ticket No. — click to copy"
                            style={{
                              display: "inline-block",
                              fontFamily: "monospace",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              background: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              borderRadius: "6px",
                              padding: "3px 7px",
                              cursor: "pointer",
                              userSelect: "all",
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => navigator.clipboard?.writeText(r.tripTicketNumber!)}
                          >
                            {r.tripTicketNumber}
                          </span>
                        ) : (
                          <span style={{ color: "#a0aec0", fontSize: "12px" }}>—</span>
                        )}
                      </td>

                      {/* 2. Plate Number & Date */}
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ color: "#1a202c", fontSize: "13.5px" }}>{r.vehiclePlateNumber}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500, marginTop: "1px" }}>
                          {formatTravelDateRange(r.travelDate, r.travelDateEnd)}
                        </div>
                      </td>

                      {/* 3. Location / Office Province */}
                      <td style={{ fontSize: "12.5px", fontWeight: 600, color: "#2d3748" }}>
                        {r.location || "—"}
                      </td>

                      {/* 3. Driver Name and Pic */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Avatar photoURL={driver?.photoURL} name={driverName} size={26} />
                          <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#2d3748" }}>
                            {driverName}
                          </span>
                        </div>
                      </td>

                      {/* 4. Requester Name */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "12.5px", color: "#2d3748" }}>{r.requesterName}</div>
                        {r.requesterOffice && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.requesterOffice}</div>
                        )}
                      </td>

                      {/* 5. Passengers */}
                      <td>
                        <PassengersCell request={r} />
                      </td>

                      {/* 6. Destination */}
                      <td>
                        <div style={{ fontWeight: 600, color: "#166534", fontSize: "12.5px" }}>📍 {r.destination}</div>
                      </td>

                      {/* 7. Purpose */}
                      <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {r.purpose || "—"}
                      </td>

                      {/* 8. Status */}
                      <td>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "3.5px 9px",
                            borderRadius: "999px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <BadgeIcon size={10} />
                          {r.status}
                        </span>
                      </td>

                      {/* 9. Approver */}
                      <td>
                        {r.approvedByName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Avatar name={r.approvedByName} size={22} />
                            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#2d3748" }}>
                              {r.approvedByName}
                            </span>
                          </div>
                        ) : r.status === "approved" ? (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Approved
                          </span>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#a0aec0" }}>—</span>
                        )}
                      </td>

                      {/* 10. Action button review/view */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => setReviewing(r)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            border: "none",
                            background: r.status === "pending" ? "linear-gradient(135deg, #00b377 0%, #008f58 100%)" : "#edf2f7",
                            color: r.status === "pending" ? "#fff" : "#2d3748",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: r.status === "pending" ? "0 2px 6px rgba(0, 179, 119, 0.25)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {r.status === "pending" ? "Review" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="requests"
          />
        </>
      )}

      {reviewing && (
        <ReviewModal
          request={reviewing}
          drivers={drivers}
          busyDriverIds={busyDriverIds(reviewing.travelDate, reviewing.travelDateEnd, reviewing.id)}
          vehicleDoubleBooked={isVehicleDoubleBooked(
            reviewing.vehiclePlateNumber,
            reviewing.travelDate,
            reviewing.travelDateEnd,
            reviewing.id
          )}
          onClose={() => setReviewing(null)}
          onApprove={handleApprove}
          onDecline={handleDecline}
          onUpdateDriver={handleUpdateDriver}
        />
      )}
    </div>
  );
}

function requestVehicleId(request: VehicleRequest): string {
  return request.vehicleId;
}

function ReviewModal({
  request,
  drivers,
  busyDriverIds,
  vehicleDoubleBooked,
  onClose,
  onApprove,
  onDecline,
  onUpdateDriver,
}: {
  request: VehicleRequest;
  drivers: AppUser[];
  busyDriverIds: Set<string>;
  vehicleDoubleBooked: boolean;
  onClose: () => void;
  onApprove: (request: VehicleRequest, driverId: string, driverName: string) => Promise<void>;
  onDecline: (request: VehicleRequest, reason: string) => Promise<void>;
  onUpdateDriver: (request: VehicleRequest, driverId: string, driverName: string) => Promise<void>;
}) {
  const [driverAvailable, setDriverAvailable] = useState<boolean | null>(
    request.status !== "pending" ? true : null
  );
  const [substituteId, setSubstituteId] = useState("");
  const [declineReason, setDeclineReason] = useState(request.declineReason || "");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editing driver on approved request
  const [editingApprovedDriver, setEditingApprovedDriver] = useState(false);
  const [selectedApprovedDriverId, setSelectedApprovedDriverId] = useState(
    request.confirmedDriverId || ""
  );
  const [confirmUpdateDriverOpen, setConfirmUpdateDriverOpen] = useState(false);

  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);

  const isPending = request.status === "pending";
  const isApproved = request.status === "approved";

  // The driver who would actually be confirmed if Approve is pressed right
  // now, given the current Yes/No choice above.
  const effectiveDriverId =
    driverAvailable === true ? request.defaultDriverId || "" : driverAvailable === false ? substituteId : "";
  const effectiveDriverName =
    driverAvailable === true
      ? request.defaultDriverName || "Default Assigned Driver"
      : drivers.find((d) => d.id === substituteId)?.name || "Substitute Driver";
  const driverDoubleBooked = !!effectiveDriverId && busyDriverIds.has(effectiveDriverId);

  // Either conflict makes an approval physically impossible to honor — the
  // same vehicle, or the same driver, can't be on two trips at once — so
  // approval is blocked rather than just flagged, until it's resolved by
  // declining this request or (for a driver conflict) picking someone else.
  const blockedByConflict = vehicleDoubleBooked || driverDoubleBooked;

  async function executeApprove() {
    setConfirmApproveOpen(false);
    if (blockedByConflict) return;
    setSaving(true);
    try {
      if (driverAvailable) {
        await onApprove(request, request.defaultDriverId || "", request.defaultDriverName || "");
      } else {
        const sub = drivers.find((d) => d.id === substituteId);
        if (!sub) return;
        await onApprove(request, sub.id, sub.name);
      }
    } finally {
      setSaving(false);
    }
  }

  async function executeDecline() {
    setConfirmDeclineOpen(false);
    setSaving(true);
    try {
      await onDecline(request, declineReason);
    } finally {
      setSaving(false);
    }
  }

  async function executeUpdateDriver() {
    setConfirmUpdateDriverOpen(false);
    setSaving(true);
    try {
      const chosenDriver = drivers.find((d) => d.id === selectedApprovedDriverId);
      await onUpdateDriver(
        request,
        chosenDriver ? chosenDriver.id : "",
        chosenDriver ? chosenDriver.name : ""
      );
      setEditingApprovedDriver(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedApprovedDriver = drivers.find((d) => d.id === selectedApprovedDriverId);
  const selectedApprovedDriverBusy = !!selectedApprovedDriverId && busyDriverIds.has(selectedApprovedDriverId);

  return (
    <Modal title={isPending ? "Review Request" : "Request Details"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <InfoRow icon={User} label="Requester" value={request.requesterName} />
        {request.location && <InfoRow icon={MapPin} label="Location" value={request.location} />}
        {request.requesterIsPassenger && (
          <InfoRow icon={Users} label="Riding along" value="Yes — requester is also a passenger" />
        )}
        {request.requesterOffice && <InfoRow icon={Building2} label="Office" value={request.requesterOffice} />}
        {request.requesterContact && <InfoRow icon={Phone} label="Contact" value={request.requesterContact} />}
        <InfoRow icon={Truck} label="Vehicle" value={request.vehiclePlateNumber} />
        <InfoRow icon={MapPin} label="Destination" value={request.destination} />
        <InfoRow icon={CalendarDays} label="Travel Date" value={formatTravelDateRange(request.travelDate, request.travelDateEnd)} />
        <InfoRow icon={FileText} label="Purpose" value={request.purpose} />
        {request.passengers && request.passengers.length > 0 && (
          <InfoRow icon={Users} label="Passengers" value={request.passengers.join(", ")} />
        )}
        {request.previousTripTicketDate && (
          <InfoRow icon={CalendarDays} label="Previous Trip Ticket Date" value={request.previousTripTicketDate} />
        )}

        {request.approvedByName && (
          <InfoRow icon={ShieldCheck} label="Approved By" value={request.approvedByName} />
        )}

        {!isPending && (
          <div
            style={{
              background: request.status === "approved" ? "#e6f7ee" : "#fff5f5",
              color: request.status === "approved" ? "var(--primary)" : "var(--danger)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12.5px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              {request.status === "approved"
                ? `Approved · Driver: ${request.confirmedDriverName || "Unassigned"}${request.approvedByName ? ` · Approver: ${request.approvedByName}` : ""}`
                : `Declined${request.declineReason ? ` · ${request.declineReason}` : ""}`}
            </div>
            {isApproved && !editingApprovedDriver && (
              <button
                type="button"
                onClick={() => setEditingApprovedDriver(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--primary)",
                  background: "#fff",
                  color: "var(--primary)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Pencil size={12} />
                Change Driver
              </button>
            )}
          </div>
        )}

        {isApproved && editingApprovedDriver && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#2d3748", display: "flex", alignItems: "center", gap: "6px" }}>
              <UserCheck size={16} style={{ color: "var(--primary)" }} />
              Update Assigned Driver
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Select driver for this trip:
              </span>
              <select
                value={selectedApprovedDriverId}
                onChange={(e) => setSelectedApprovedDriverId(e.target.value)}
                style={{ padding: "9px 11px", borderRadius: "8px", border: "1.5px solid var(--border)", fontSize: "13px" }}
              >
                <option value="">— Unassigned —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {busyDriverIds.has(d.id) && d.id !== request.confirmedDriverId ? "(busy that day)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedApprovedDriverBusy && selectedApprovedDriverId !== request.confirmedDriverId && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--danger)",
                  background: "#fff5f5",
                  padding: "8px 10px",
                  borderRadius: "8px",
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                This driver is already confirmed on another approved trip that overlaps this date.
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setEditingApprovedDriver(false);
                  setSelectedApprovedDriverId(request.confirmedDriverId || "");
                }}
                disabled={saving}
                style={{
                  padding: "6px 14px",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "#4a5568",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmUpdateDriverOpen(true)}
                disabled={saving || (selectedApprovedDriverBusy && selectedApprovedDriverId !== request.confirmedDriverId)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 179, 119, 0.25)",
                }}
              >
                {saving ? "Saving…" : "Save Driver"}
              </button>
            </div>
          </div>
        )}

        {isPending && !showDeclineForm && (
          <>
            {vehicleDoubleBooked && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "12.5px",
                  color: "var(--danger)",
                  background: "#fff5f5",
                  border: "1px solid #feb2b2",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontWeight: 500,
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>{request.vehiclePlateNumber}</strong> is already committed to another approved
                  request that overlaps this travel date. A vehicle can't be in two places at once — decline
                  this request, or wait until the conflicting trip is no longer approved, before approving it.
                </span>
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#2d3748" }}>
                Is {request.defaultDriverName || "the assigned driver"} available for this trip?
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDriverAvailable(true)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: driverAvailable === true ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: driverAvailable === true ? "#e6f7ee" : "#fff",
                    color: driverAvailable === true ? "var(--primary)" : "#2d3748",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Yes, available
                </button>
                <button
                  type="button"
                  onClick={() => setDriverAvailable(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: driverAvailable === false ? "2px solid var(--warning)" : "1px solid var(--border)",
                    background: driverAvailable === false ? "#fff8e6" : "#fff",
                    color: driverAvailable === false ? "var(--warning)" : "#2d3748",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Not available
                </button>
              </div>

              {driverAvailable === true && effectiveDriverId && busyDriverIds.has(effectiveDriverId) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    fontSize: "12px",
                    color: "var(--danger)",
                    background: "#fff5f5",
                    padding: "8px 10px",
                    borderRadius: "8px",
                  }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {request.defaultDriverName || "This driver"} is already confirmed on another approved trip
                  that overlaps this date — one driver can't cover two trips at once. Mark them "Not
                  available" and choose a different driver, or decline this request.
                </div>
              )}

              {driverAvailable === false && (
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                    Choose a substitute driver
                  </span>
                  <select
                    value={substituteId}
                    onChange={(e) => setSubstituteId(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13.5px" }}
                  >
                    <option value="">— Select a driver —</option>
                    {drivers
                      .filter((d) => d.id !== request.defaultDriverId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {busyDriverIds.has(d.id) ? "(busy that day)" : ""}
                        </option>
                      ))}
                  </select>
                  {substituteId && busyDriverIds.has(substituteId) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--danger)",
                        background: "#fff5f5",
                        padding: "8px 10px",
                        borderRadius: "8px",
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      This driver is already confirmed on another approved trip that overlaps this date —
                      one driver can't cover two trips at once. Choose someone else, or decline this
                      request.
                    </div>
                  )}
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setShowDeclineForm(true)}
                disabled={saving}
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--danger)",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setConfirmApproveOpen(true)}
                disabled={
                  saving ||
                  driverAvailable === null ||
                  (driverAvailable === false && !substituteId) ||
                  blockedByConflict
                }
                title={blockedByConflict ? "Resolve the scheduling conflict above before approving." : undefined}
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  boxShadow: "0 2px 8px rgba(0, 179, 119, 0.28)",
                  opacity:
                    driverAvailable === null || (driverAvailable === false && !substituteId) || blockedByConflict
                      ? 0.6
                      : 1,
                  cursor: blockedByConflict ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Approving..." : "Approve Request"}
              </button>
            </div>
          </>
        )}

        {isPending && showDeclineForm && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4a5568" }}>
                Reason (optional)
              </span>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={{
                  padding: "8px 11px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  minHeight: "70px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="e.g. Vehicle already booked that day"
              />
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setShowDeclineForm(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "#2d3748",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeclineOpen(true)}
                disabled={saving}
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {saving ? "Declining..." : "Decline Request"}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Approve Dialog */}
        <ConfirmDialog
          open={confirmApproveOpen}
          title="Confirm Request Approval?"
          danger={false}
          confirmLabel="Yes, Approve Request"
          confirmingLabel="Approving..."
          message={
            <div>
              Are you sure you want to approve this travel request for <strong>{request.requesterName}</strong>?
              <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                • Vehicle: <strong>{request.vehiclePlateNumber}</strong>
                <br />
                • Destination: <strong>{request.destination}</strong>
                <br />
                • Assigned Driver: <strong>{effectiveDriverName}</strong>
              </div>
            </div>
          }
          loading={saving}
          onCancel={() => setConfirmApproveOpen(false)}
          onConfirm={executeApprove}
        />

        {/* Confirm Decline Dialog */}
        <ConfirmDialog
          open={confirmDeclineOpen}
          title="Confirm Request Decline?"
          danger={true}
          confirmLabel="Yes, Decline Request"
          confirmingLabel="Declining..."
          message={
            <div>
              Are you sure you want to decline this travel request from <strong>{request.requesterName}</strong>?
              {declineReason && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                  Reason: <em>"{declineReason}"</em>
                </div>
              )}
            </div>
          }
          loading={saving}
          onCancel={() => setConfirmDeclineOpen(false)}
          onConfirm={executeDecline}
        />

        {/* Confirm Update Driver Dialog */}
        <ConfirmDialog
          open={confirmUpdateDriverOpen}
          title="Update Assigned Driver?"
          danger={false}
          confirmLabel="Yes, Update Driver"
          confirmingLabel="Updating..."
          message={
            <div>
              Are you sure you want to change the assigned driver for this trip to{" "}
              <strong>{selectedApprovedDriver ? selectedApprovedDriver.name : "Unassigned"}</strong>?
            </div>
          }
          loading={saving}
          onCancel={() => setConfirmUpdateDriverOpen(false)}
          onConfirm={executeUpdateDriver}
        />
      </div>
    </Modal>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "6px",
          background: "#f7fafc",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: "13px", color: "#2d3748", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function PassengersCell({ request }: { request: VehicleRequest }) {
  const [expanded, setExpanded] = useState(false);

  const allPassengers = useMemo(() => {
    const list: string[] = [];
    if (request.requesterIsPassenger && request.requesterName) {
      list.push(`${request.requesterName} (Requester)`);
    }
    if (request.passengers && Array.isArray(request.passengers)) {
      request.passengers.forEach((p) => {
        const trimmed = p?.trim();
        if (trimmed && !list.some((existing) => existing.startsWith(trimmed))) {
          list.push(trimmed);
        }
      });
    }
    return list;
  }, [request]);

  if (allPassengers.length === 0) {
    return <span style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>—</span>;
  }

  if (allPassengers.length === 1) {
    return (
      <div style={{ fontSize: "12.5px", color: "#2d3748", fontWeight: 500 }} title={allPassengers[0]}>
        {allPassengers[0]}
      </div>
    );
  }

  const firstPassenger = allPassengers[0];
  const remainingCount = allPassengers.length - 1;

  return (
    <div style={{ fontSize: "12.5px" }}>
      <div>
        <span style={{ color: "#2d3748", fontWeight: 500 }}>{firstPassenger}</span>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              marginLeft: "6px",
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--primary)",
              fontWeight: 600,
              fontSize: "11.5px",
              cursor: "pointer",
              textDecoration: "underline",
              whiteSpace: "nowrap",
            }}
          >
            +{remainingCount} more
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {allPassengers.slice(1).map((p, idx) => (
            <div key={idx} style={{ color: "#4a5568", fontSize: "12px" }}>
              • {p}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{
              marginTop: "2px",
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--primary)",
              fontWeight: 600,
              fontSize: "11px",
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "underline",
            }}
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}

