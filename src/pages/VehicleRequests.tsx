import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppUser, Vehicle, VehicleRequest, VehicleRequestStatus } from "../types";
import { formatTravelDateRange, dateRangesOverlap } from "../utils/travelDate";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import HeaderSearchInput from "../components/HeaderSearchInput";
import { Avatar } from "../components/Avatar";
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
  LucideIcon,
} from "lucide-react";

const STATUS_BADGE_STYLE: Record<VehicleRequestStatus, { bg: string; border: string; color: string; icon: LucideIcon }> = {
  pending: { bg: "#ffe8b3", border: "#ffcf66", color: "#8a5a00", icon: Clock },
  approved: { bg: "#d9f5e5", border: "#a9e6c4", color: "#0f7a44", icon: CheckCircle2 },
  declined: { bg: "#fdd9d9", border: "#f7b8b8", color: "#a11e1e", icon: XCircle },
};

export default function VehicleRequests() {
  const { profile, currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleRequestStatus | "all">("pending");
  const [reviewing, setReviewing] = useState<VehicleRequest | null>(null);

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

  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      declined: requests.filter((r) => r.status === "declined").length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((r) =>
        [r.requesterName, r.vehiclePlateNumber, r.destination, r.defaultDriverName].some((f) =>
          (f || "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [requests, statusFilter, search]);

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
      await updateDoc(doc(db, "vehicleRequests", request.id), {
        status: "approved",
        confirmedDriverId: driverId || null,
        confirmedDriverName: driverName || null,
        approvedBy: currentUser?.uid || null,
        approvedByName: profile?.name || null,
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

  return (
    <div className="fade-in">
      <PageHeader
        icon={ClipboardList}
        title="Vehicle Requests"
        subtitle="Review and confirm staff requests submitted via QR code."
        actions={
          <div className="header-search-wrap">
            <HeaderSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search requester, plate, destination..."
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
        <StatCard icon={ClipboardList} label="Total Requests" value={counts.total} color="#4a5568" />
        <StatCard icon={Clock} label="Pending" value={counts.pending} color="var(--warning)" />
        <StatCard icon={CheckCircle2} label="Approved" value={counts.approved} color="var(--primary)" />
        <StatCard icon={XCircle} label="Declined" value={counts.declined} color="var(--danger)" />
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["pending", "approved", "declined", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              background: statusFilter === s ? "var(--primary)" : "#fff",
              color: statusFilter === s ? "#fff" : "#2d3748",
              fontSize: "12.5px",
              fontWeight: 600,
              textTransform: "capitalize",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

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
          <ClipboardList size={22} style={{ marginBottom: 6 }} />
          <div>No requests found.</div>
        </div>
      ) : (
        <div className="auth-table-wrap">
          <table className="auth-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>Vehicle</th>
                <th>Plate #</th>
                <th>Driver</th>
                <th>Requester</th>
                <th>Destination</th>
                <th>Purpose</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr key={r.id} className="admin-row">
                    {/* 1. Vehicle Pic */}
                    <td style={{ width: 44, paddingRight: 0 }}>
                      <Avatar
                        photoURL={vehicle?.photoURL}
                        fallback="icon"
                        icon={Truck}
                        size={32}
                        name={r.vehiclePlateNumber}
                      />
                    </td>

                    {/* 2. Plate Number */}
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      <div>{r.vehiclePlateNumber}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400 }}>
                        {formatTravelDateRange(r.travelDate, r.travelDateEnd)}
                      </div>
                    </td>

                    {/* 3. Driver Name and Pic */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <Avatar photoURL={driver?.photoURL} name={driverName} size={26} />
                        <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#2d3748", whiteSpace: "nowrap" }}>
                          {driverName}
                        </span>
                      </div>
                    </td>

                    {/* 4. Requester Name */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{r.requesterName}</div>
                      {r.requesterOffice && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.requesterOffice}</div>
                      )}
                    </td>

                    {/* 5. Destination */}
                    <td style={{ color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.destination}
                    </td>

                    {/* 6. Purpose */}
                    <td style={{ color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.purpose || "—"}
                    </td>

                    {/* 7. Status */}
                    <td>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "3px 8px",
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

                    {/* 8. Action button review/view */}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => setReviewing(r)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "7px",
                          border: "none",
                          background: r.status === "pending" ? "linear-gradient(135deg, #00b377 0%, #008f58 100%)" : "#edf2f7",
                          color: r.status === "pending" ? "#fff" : "#2d3748",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: r.status === "pending" ? "0 2px 6px rgba(0, 179, 119, 0.25)" : "none",
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
}: {
  request: VehicleRequest;
  drivers: AppUser[];
  busyDriverIds: Set<string>;
  vehicleDoubleBooked: boolean;
  onClose: () => void;
  onApprove: (request: VehicleRequest, driverId: string, driverName: string) => Promise<void>;
  onDecline: (request: VehicleRequest, reason: string) => Promise<void>;
}) {
  const [driverAvailable, setDriverAvailable] = useState<boolean | null>(
    request.status !== "pending" ? true : null
  );
  const [substituteId, setSubstituteId] = useState("");
  const [declineReason, setDeclineReason] = useState(request.declineReason || "");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPending = request.status === "pending";

  // The driver who would actually be confirmed if Approve is pressed right
  // now, given the current Yes/No choice above.
  const effectiveDriverId =
    driverAvailable === true ? request.defaultDriverId || "" : driverAvailable === false ? substituteId : "";
  const driverDoubleBooked = !!effectiveDriverId && busyDriverIds.has(effectiveDriverId);

  // Either conflict makes an approval physically impossible to honor — the
  // same vehicle, or the same driver, can't be on two trips at once — so
  // approval is blocked rather than just flagged, until it's resolved by
  // declining this request or (for a driver conflict) picking someone else.
  const blockedByConflict = vehicleDoubleBooked || driverDoubleBooked;

  async function submitApprove() {
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

  async function submitDecline() {
    setSaving(true);
    try {
      await onDecline(request, declineReason);
    } finally {
      setSaving(false);
    }
  }

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

        {!isPending && (
          <div
            style={{
              background: request.status === "approved" ? "#e6f7ee" : "#fff5f5",
              color: request.status === "approved" ? "var(--primary)" : "var(--danger)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            {request.status === "approved"
              ? `Approved · Driver: ${request.confirmedDriverName || "Unassigned"}`
              : `Declined${request.declineReason ? ` · ${request.declineReason}` : ""}`}
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
                onClick={submitApprove}
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
                onClick={submitDecline}
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
                {saving ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        )}
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
