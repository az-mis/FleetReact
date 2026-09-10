import React, { useState } from "react";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  ChevronRight,
  Calendar,
  ChevronLeft,
  MapPin,
  Building2,
  Car,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Vehicle, VehicleRequest, AppUser } from "../types";
import { LOCATION_CODE } from "../utils/ticketNumber";

interface DashboardChartsProps {
  requests: VehicleRequest[];
  vehicles: Vehicle[];
  drivers: AppUser[];
  isSuperAdmin: boolean;
  selectedLocation: string;
  adminLocation?: string;
}

const ALL_LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
];

const LOCATION_COLORS: Record<string, string> = {
  "Oriental Mindoro": "#10b981", // Emerald
  "Occidental Mindoro": "#3b82f6", // Blue
  "Marinduque": "#f59e0b", // Amber
  "Palawan": "#8b5cf6", // Purple
  "Romblon": "#ec4899", // Pink
  "Quezon City Satellite Office": "#06b6d4", // Cyan
};

export default function DashboardCharts({
  requests,
  vehicles,
  drivers,
  isSuperAdmin,
  selectedLocation,
  adminLocation,
}: DashboardChartsProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [adminReportTab, setAdminReportTab] = useState<"destinations" | "offices" | "fleet">("destinations");
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [trendViewMode, setTrendViewMode] = useState<"daily" | "monthly">("daily");

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultYearMonth);
  const [hoveredDay, setHoveredDay] = useState<{ day: number; count: number; dateStr: string } | null>(null);

  // Determine active location context for regular admin vs super admin
  const currentLocation = !isSuperAdmin ? adminLocation : selectedLocation;

  // Approved trips data
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const totalApproved = approvedRequests.length;

  const locationStats = ALL_LOCATIONS.map((loc) => {
    const locApproved = requests.filter((r) => r.location === loc && r.status === "approved").length;
    const locPending = requests.filter((r) => r.location === loc && r.status === "pending").length;
    const code = LOCATION_CODE[loc] || loc.slice(0, 3).toUpperCase();
    const color = LOCATION_COLORS[loc] || "#1a6b3c";

    return {
      location: loc,
      code,
      color,
      approvedCount: locApproved,
      pendingCount: locPending,
      percentage: totalApproved > 0 ? Math.round((locApproved / totalApproved) * 100) : 0,
    };
  });

  const maxApproved = Math.max(...locationStats.map((s) => s.approvedCount), 1);

  // Status Distribution
  const statusCounts = {
    approved: requests.filter((r) => r.status === "approved").length,
    pending: requests.filter((r) => r.status === "pending").length,
    declined: requests.filter((r) => r.status === "declined").length,
  };
  const totalAllRequests = requests.length || 1;

  // 1. Top Destinations Breakdown for Location Admin
  const destinationMap = new Map<string, number>();
  approvedRequests.forEach((r) => {
    const dest = (r.destination || "Unspecified").trim();
    destinationMap.set(dest, (destinationMap.get(dest) || 0) + 1);
  });
  const destinationStats = Array.from(destinationMap.entries())
    .map(([destination, count]) => ({
      destination,
      count,
      percentage: totalApproved > 0 ? Math.round((count / totalApproved) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxDestinationCount = Math.max(...destinationStats.map((d) => d.count), 1);

  // 2. Top Requesting Offices / Units for Location Admin
  const officeMap = new Map<string, number>();
  approvedRequests.forEach((r) => {
    const off = (r.requesterOffice || "General Staff").trim();
    officeMap.set(off, (officeMap.get(off) || 0) + 1);
  });
  const officeStats = Array.from(officeMap.entries())
    .map(([office, count]) => ({
      office,
      count,
      percentage: totalApproved > 0 ? Math.round((count / totalApproved) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxOfficeCount = Math.max(...officeStats.map((o) => o.count), 1);

  // 3. Fleet Operational Availability Snapshot for Location Admin
  const activeTripsToday = approvedRequests.filter((r) => {
    const start = r.travelDate;
    const end = r.travelDateEnd || r.travelDate;
    return start <= todayStr && end >= todayStr;
  });
  const activeVehiclePlatesToday = new Set(activeTripsToday.map((r) => r.vehiclePlateNumber));

  const vehicleStats = vehicles.map((v) => {
    const tripCount = approvedRequests.filter((r) => r.vehiclePlateNumber === v.plateNumber).length;
    const isDispatchedToday = activeVehiclePlatesToday.has(v.plateNumber);
    return {
      plateNumber: v.plateNumber,
      model: `${v.brand || ""} ${v.model || ""}`.trim() || v.plateNumber,
      vehicleType: v.vehicleType,
      tripCount,
      hasDriver: Boolean(v.assignedDriverId),
      isDispatchedToday,
      percentage: totalApproved > 0 ? Math.round((tripCount / totalApproved) * 100) : 0,
    };
  }).sort((a, b) => b.tripCount - a.tripCount);

  const maxVehicleTrips = Math.max(...vehicleStats.map((v) => v.tripCount), 1);

  // 6-Month Volume Trend
  const currentYear = today.getFullYear();
  const monthsData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const yStr = d.getFullYear();
    const mNum = String(d.getMonth() + 1).padStart(2, "0");
    const ym = `${yStr}-${mNum}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const count = approvedRequests.filter((r) => (r.travelDate || "").startsWith(ym)).length;
    return { label, count, monthNum: mNum, yearMonth: ym, fullLabel: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) };
  });

  const maxMonthCount = Math.max(...monthsData.map((m) => m.count), 1);

  // Daily Requests Breakdown for Selected Month
  const [sYear, sMonth] = selectedMonth.split("-").map(Number);
  const daysInSelectedMonth = new Date(sYear, sMonth, 0).getDate();
  const selectedMonthName = new Date(sYear, sMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const dailyStats = Array.from({ length: daysInSelectedMonth }, (_, idx) => {
    const dayNum = idx + 1;
    const dayStr = String(dayNum).padStart(2, "0");
    const datePattern = `${selectedMonth}-${dayStr}`;
    
    // Count requests on this date (by travelDate or travelDate start)
    const dayApproved = approvedRequests.filter((r) => (r.travelDate || "").startsWith(datePattern)).length;
    const dayTotal = requests.filter((r) => (r.travelDate || "").startsWith(datePattern)).length;
    
    const isToday = today.getFullYear() === sYear && (today.getMonth() + 1) === sMonth && today.getDate() === dayNum;

    return {
      day: dayNum,
      dayStr,
      datePattern,
      approvedCount: dayApproved,
      totalCount: dayTotal,
      isToday,
    };
  });

  const maxDailyCount = Math.max(...dailyStats.map((d) => d.totalCount), 1);
  const totalMonthRequests = dailyStats.reduce((acc, d) => acc + d.totalCount, 0);
  const totalMonthApproved = dailyStats.reduce((acc, d) => acc + d.approvedCount, 0);

  // SVG Pie Chart Coordinates
  let cumulativePercent = 0;
  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
        gap: "12px",
      }}
    >
      {/* ── CARD 1: Trip Tickets Breakdown (Location for Super Admin, Fleet Utilization for Local Admin) ── */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Compact Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isSuperAdmin ? (
              <BarChart3 size={15} color="var(--primary)" />
            ) : adminReportTab === "destinations" ? (
              <MapPin size={15} color="#e11d48" />
            ) : adminReportTab === "offices" ? (
              <Building2 size={15} color="#0284c7" />
            ) : (
              <Car size={15} color="var(--primary)" />
            )}
            <span style={{ fontSize: "12.5px", fontWeight: 750, color: "#1e293b" }}>
              {isSuperAdmin
                ? "Trip Tickets by Location"
                : adminReportTab === "destinations"
                ? "Top Destinations"
                : adminReportTab === "offices"
                ? "Top Requesting Units"
                : `Fleet Utilization (${currentLocation || "All"})`}
            </span>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "999px",
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
              }}
            >
              {totalApproved}
            </span>
          </div>

          {/* Controls: Super Admin Bar/Donut toggle OR Regular Admin Tab Pills */}
          {isSuperAdmin ? (
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "1.5px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setChartType("bar")}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: chartType === "bar" ? "#ffffff" : "transparent",
                  color: chartType === "bar" ? "var(--primary)" : "#64748b",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: chartType === "bar" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Bar
              </button>
              <button
                type="button"
                onClick={() => setChartType("pie")}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: chartType === "pie" ? "#ffffff" : "transparent",
                  color: chartType === "pie" ? "var(--primary)" : "#64748b",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: chartType === "pie" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Donut
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "1.5px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setAdminReportTab("destinations")}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "none",
                  background: adminReportTab === "destinations" ? "#ffffff" : "transparent",
                  color: adminReportTab === "destinations" ? "#e11d48" : "#64748b",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: adminReportTab === "destinations" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Destinations
              </button>
              <button
                type="button"
                onClick={() => setAdminReportTab("offices")}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "none",
                  background: adminReportTab === "offices" ? "#ffffff" : "transparent",
                  color: adminReportTab === "offices" ? "#0284c7" : "#64748b",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: adminReportTab === "offices" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Offices
              </button>
              <button
                type="button"
                onClick={() => setAdminReportTab("fleet")}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "none",
                  background: adminReportTab === "fleet" ? "#ffffff" : "transparent",
                  color: adminReportTab === "fleet" ? "var(--primary)" : "#64748b",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: adminReportTab === "fleet" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Fleet
              </button>
            </div>
          )}
        </div>

        {/* Compact Content: Super Admin view (By Location) vs Regular Admin Multi-Tab View */}
        {isSuperAdmin ? (
          chartType === "bar" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {locationStats.map((item) => {
                const isHovered = hoveredLocation === item.location;
                const isSelected = selectedLocation === item.location;
                const barWidth = maxApproved > 0 ? (item.approvedCount / maxApproved) * 100 : 0;

                return (
                  <div
                    key={item.location}
                    onMouseEnter={() => setHoveredLocation(item.location)}
                    onMouseLeave={() => setHoveredLocation(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "3px 5px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(26, 107, 60, 0.08)" : isHovered ? "#f8fafc" : "transparent",
                      transition: "background 0.1s ease",
                    }}
                  >
                    {/* Location label */}
                    <div style={{ width: "95px", display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: isSelected ? "var(--primary)" : "#334155",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={item.location}
                      >
                        {item.code} · <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 500 }}>{item.location.replace(" Satellite Office", "")}</span>
                      </span>
                    </div>

                    {/* Micro Progress Bar */}
                    <div
                      style={{
                        flex: 1,
                        height: "6px",
                        borderRadius: "999px",
                        background: "#e2e8f0",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(barWidth, item.approvedCount > 0 ? 4 : 0)}%`,
                          background: item.color,
                          borderRadius: "999px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    {/* Count & % */}
                    <div style={{ width: "42px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: item.approvedCount > 0 ? "#0f172a" : "#94a3b8", flexShrink: 0 }}>
                      {item.approvedCount} <span style={{ fontSize: "9.5px", fontWeight: 500, color: "var(--text-muted)" }}>({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact Donut View for Locations */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "4px 6px" }}>
              <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                <svg viewBox="-1 -1 2 2" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                  {totalApproved === 0 ? (
                    <circle cx="0" cy="0" r="0.8" fill="none" stroke="#e2e8f0" strokeWidth="0.3" />
                  ) : (
                    locationStats.map((slice) => {
                      if (slice.approvedCount === 0) return null;
                      const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                      cumulativePercent += slice.approvedCount / totalApproved;
                      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                      const largeArcFlag = slice.approvedCount / totalApproved > 0.5 ? 1 : 0;
                      const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

                      return (
                        <path
                          key={slice.location}
                          d={pathData}
                          fill={slice.color}
                          opacity={hoveredLocation && hoveredLocation !== slice.location ? 0.35 : 1}
                          style={{ transition: "opacity 0.15s ease" }}
                          onMouseEnter={() => setHoveredLocation(slice.location)}
                          onMouseLeave={() => setHoveredLocation(null)}
                        />
                      );
                    })
                  )}
                  <circle cx="0" cy="0" r="0.65" fill="#ffffff" />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {totalApproved}
                  </span>
                  <span style={{ fontSize: "8.5px", fontWeight: 700, color: "var(--text-muted)", marginTop: "1px" }}>
                    TICKETS
                  </span>
                </div>
              </div>

              {/* Micro 2-Column Legend */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px", flex: 1 }}>
                {locationStats.map((item) => (
                  <div
                    key={item.location}
                    onMouseEnter={() => setHoveredLocation(item.location)}
                    onMouseLeave={() => setHoveredLocation(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "10.5px",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      background: hoveredLocation === item.location ? "#f1f5f9" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: "#475569" }}>{item.code}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.approvedCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Regular Admin Multi-Tab View */
          adminReportTab === "destinations" ? (
            /* TAB 1: Top Destinations */
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {destinationStats.length === 0 ? (
                <div style={{ padding: "12px 0", textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                  No approved trip destinations recorded yet.
                </div>
              ) : (
                destinationStats.map((item) => {
                  const isHovered = hoveredLocation === item.destination;
                  const barWidth = maxDestinationCount > 0 ? (item.count / maxDestinationCount) * 100 : 0;

                  return (
                    <div
                      key={item.destination}
                      onMouseEnter={() => setHoveredLocation(item.destination)}
                      onMouseLeave={() => setHoveredLocation(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "3px 5px",
                        borderRadius: "6px",
                        background: isHovered ? "#f8fafc" : "transparent",
                        transition: "background 0.1s ease",
                      }}
                    >
                      {/* Destination label */}
                      <div style={{ width: "115px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        <span style={{ color: "#e11d48", fontSize: "11px" }}>📍</span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 650,
                            color: "#334155",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.destination}
                        >
                          {item.destination}
                        </span>
                      </div>

                      {/* Micro Progress Bar */}
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "999px",
                          background: "#e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(barWidth, item.count > 0 ? 4 : 0)}%`,
                            background: "linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)",
                            borderRadius: "999px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>

                      {/* Count & % */}
                      <div style={{ width: "42px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>
                        {item.count} <span style={{ fontSize: "9.5px", fontWeight: 500, color: "var(--text-muted)" }}>({item.percentage}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : adminReportTab === "offices" ? (
            /* TAB 2: Top Requesting Offices */
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {officeStats.length === 0 ? (
                <div style={{ padding: "12px 0", textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                  No requesting offices recorded yet.
                </div>
              ) : (
                officeStats.map((item) => {
                  const isHovered = hoveredLocation === item.office;
                  const barWidth = maxOfficeCount > 0 ? (item.count / maxOfficeCount) * 100 : 0;

                  return (
                    <div
                      key={item.office}
                      onMouseEnter={() => setHoveredLocation(item.office)}
                      onMouseLeave={() => setHoveredLocation(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "3px 5px",
                        borderRadius: "6px",
                        background: isHovered ? "#f8fafc" : "transparent",
                        transition: "background 0.1s ease",
                      }}
                    >
                      {/* Office label */}
                      <div style={{ width: "115px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        <span style={{ color: "#0284c7", fontSize: "11px" }}>🏢</span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 650,
                            color: "#334155",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.office}
                        >
                          {item.office}
                        </span>
                      </div>

                      {/* Micro Progress Bar */}
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "999px",
                          background: "#e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(barWidth, item.count > 0 ? 4 : 0)}%`,
                            background: "linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)",
                            borderRadius: "999px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>

                      {/* Count & % */}
                      <div style={{ width: "42px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>
                        {item.count} <span style={{ fontSize: "9.5px", fontWeight: 500, color: "var(--text-muted)" }}>({item.percentage}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* TAB 3: Fleet Status & Vehicle Trip Breakdown */
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {vehicleStats.length === 0 ? (
                <div style={{ padding: "12px 0", textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                  No vehicles registered for this location yet.
                </div>
              ) : (
                vehicleStats.slice(0, 5).map((item) => {
                  const isHovered = hoveredLocation === item.plateNumber;
                  const barWidth = maxVehicleTrips > 0 ? (item.tripCount / maxVehicleTrips) * 100 : 0;

                  return (
                    <div
                      key={item.plateNumber}
                      onMouseEnter={() => setHoveredLocation(item.plateNumber)}
                      onMouseLeave={() => setHoveredLocation(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "3px 5px",
                        borderRadius: "6px",
                        background: isHovered ? "#f8fafc" : "transparent",
                        transition: "background 0.1s ease",
                      }}
                    >
                      {/* Vehicle label + Real-time Status Badge */}
                      <div style={{ width: "115px", display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: item.isDispatchedToday ? "#e11d48" : item.hasDriver ? "#10b981" : "#94a3b8",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#334155",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.plateNumber}
                        >
                          {item.plateNumber}
                        </span>
                        {item.isDispatchedToday && (
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#e11d48", background: "#ffe4e6", padding: "1px 3px", borderRadius: "3px" }}>
                            On Trip
                          </span>
                        )}
                      </div>

                      {/* Micro Progress Bar */}
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "999px",
                          background: "#e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(barWidth, item.tripCount > 0 ? 4 : 0)}%`,
                            background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                            borderRadius: "999px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>

                      {/* Count & % */}
                      <div style={{ width: "42px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: item.tripCount > 0 ? "#0f172a" : "#94a3b8", flexShrink: 0 }}>
                        {item.tripCount} <span style={{ fontSize: "9.5px", fontWeight: 500, color: "var(--text-muted)" }}>({item.percentage}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )
        )}
      </div>

      {/* ── CARD 2: Daily Requests per Month & Status Breakdown ── */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Compact Header with View Mode & Month Selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp size={15} color="#2563eb" />
            <span style={{ fontSize: "12.5px", fontWeight: 750, color: "#1e293b" }}>
              {trendViewMode === "daily" ? "Daily Requests" : `Monthly Trend (${currentYear})`}
            </span>
            {trendViewMode === "daily" && (
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                {totalMonthRequests} total
              </span>
            )}
          </div>

          {/* Controls: Mode toggle + Month Selector dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {trendViewMode === "daily" && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: "2px 6px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: "#334155",
                  background: "#f8fafc",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {monthsData.map((m) => (
                  <option key={m.yearMonth} value={m.yearMonth}>
                    {m.fullLabel}
                  </option>
                ))}
              </select>
            )}

            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "1.5px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setTrendViewMode("daily")}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: trendViewMode === "daily" ? "#ffffff" : "transparent",
                  color: trendViewMode === "daily" ? "#2563eb" : "#64748b",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: trendViewMode === "daily" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setTrendViewMode("monthly")}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: trendViewMode === "monthly" ? "#ffffff" : "transparent",
                  color: trendViewMode === "monthly" ? "#2563eb" : "#64748b",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: trendViewMode === "monthly" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.1s ease",
                }}
              >
                6-Mo
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Daily Requests per Month High-Density Chart */}
        {trendViewMode === "daily" ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                height: "64px",
                padding: "4px 2px 0 2px",
                borderBottom: "1px solid #e2e8f0",
                position: "relative",
              }}
            >
              {dailyStats.map((d) => {
                const barHeightPercent = maxDailyCount > 0 ? (d.totalCount / maxDailyCount) * 100 : 0;
                const isHovered = hoveredDay?.day === d.day;

                return (
                  <div
                    key={d.day}
                    onMouseEnter={() => setHoveredDay({ day: d.day, count: d.totalCount, dateStr: d.datePattern })}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    title={`Day ${d.day} (${d.datePattern}): ${d.totalCount} request(s) - ${d.approvedCount} approved`}
                  >
                    {/* Bar */}
                    <div
                      style={{
                        width: "100%",
                        minWidth: "3px",
                        maxWidth: "10px",
                        height: `${Math.max(barHeightPercent, d.totalCount > 0 ? 14 : 3)}%`,
                        borderRadius: "2px 2px 0 0",
                        background: isHovered
                          ? "#1d4ed8"
                          : d.isToday
                          ? "#10b981"
                          : d.totalCount > 0
                          ? "#3b82f6"
                          : "#e2e8f0",
                        transition: "all 0.15s ease",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Daily Legend / Tooltip info below histogram */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "3px 2px 0 2px",
                fontSize: "9.5px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              <span>Day 1</span>
              {hoveredDay ? (
                <span style={{ color: "#1e293b", fontWeight: 700 }}>
                  Day {hoveredDay.day}: <b style={{ color: "var(--primary)" }}>{hoveredDay.count}</b> requests
                </span>
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: "9px" }}>
                  {selectedMonthName}
                </span>
              )}
              <span>Day {daysInSelectedMonth}</span>
            </div>
          </div>
        ) : (
          /* View 2: 6-Month Trend Histogram */
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "6px",
              height: "64px",
              padding: "4px 4px 0 4px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            {monthsData.map((m, idx) => {
              const heightPercent = maxMonthCount > 0 ? (m.count / maxMonthCount) * 100 : 0;
              const isCurrent = idx === monthsData.length - 1;

              return (
                <div
                  key={m.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    flex: 1,
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  {/* Number */}
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      color: m.count > 0 ? (isCurrent ? "var(--primary)" : "#334155") : "#94a3b8",
                    }}
                  >
                    {m.count}
                  </span>

                  {/* Vertical Bar */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "20px",
                      height: `${Math.max(heightPercent, m.count > 0 ? 8 : 4)}%`,
                      borderRadius: "4px 4px 1px 1px",
                      background: isCurrent
                        ? "linear-gradient(180deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)",
                      transition: "height 0.3s ease",
                    }}
                  />

                  {/* Label */}
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: isCurrent ? 800 : 600,
                      color: isCurrent ? "var(--primary)" : "#64748b",
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Breakdown Bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px" }}>
            <span style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Request Status Breakdown
            </span>
            <span style={{ fontWeight: 700, color: "#1e293b" }}>
              {requests.length} Total
            </span>
          </div>

          {/* Micro Segmented Bar */}
          <div
            style={{
              height: "6px",
              width: "100%",
              borderRadius: "999px",
              background: "#f1f5f9",
              display: "flex",
              overflow: "hidden",
              gap: "1.5px",
            }}
          >
            <div
              title={`Approved: ${statusCounts.approved}`}
              style={{
                width: `${(statusCounts.approved / totalAllRequests) * 100}%`,
                background: "#10b981",
                borderRadius: "999px 0 0 999px",
              }}
            />
            <div
              title={`Pending: ${statusCounts.pending}`}
              style={{
                width: `${(statusCounts.pending / totalAllRequests) * 100}%`,
                background: "#f59e0b",
              }}
            />
            <div
              title={`Declined: ${statusCounts.declined}`}
              style={{
                width: `${(statusCounts.declined / totalAllRequests) * 100}%`,
                background: "#ef4444",
                borderRadius: "0 999px 999px 0",
              }}
            />
          </div>

          {/* Micro Legend */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "1px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ color: "#334155", fontWeight: 600 }}>Approved: <b>{statusCounts.approved}</b></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ color: "#334155", fontWeight: 600 }}>Pending: <b>{statusCounts.pending}</b></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ color: "#334155", fontWeight: 600 }}>Declined: <b>{statusCounts.declined}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
