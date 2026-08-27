/* ───────────────────────── Roles & Users ───────────────────────── */

export type UserRole = "super_admin" | "admin" | "driver";

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  driver: "Driver",
};

export const USER_ROLE_COLOR: Record<UserRole, string> = {
  super_admin: "#7e57c2",
  admin: "#2b6cb0",
  driver: "#1a6b3c",
};

// Mirrors Modules/Admin/Enums/UserRole.php from the source Laravel app.
export interface AppUser {
  id: string; // Firestore doc id === Firebase Auth uid
  name: string;
  email: string;
  role: UserRole;
  // Small (~150px) compressed JPEG stored inline as a data URL — no Firebase
  // Storage dependency (this project intentionally stays on the Firestore
  // free tier only), and a thumbnail this size comfortably fits Firestore's
  // 1 MiB document limit.
  photoURL?: string | null;
  birthDate?: string | null; // yyyy-mm-dd, drivers only
  address?: string | null; // drivers only
  licenseExpirationDate?: string | null; // yyyy-mm-dd, drivers only
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

/* ───────────────────────── Feature Flags (CMS) ───────────────────────── */

// Lets a super_admin turn whole modules on/off for the "admin" and "driver"
// roles without touching code or Firestore rules. Super admins themselves
// are never gated by these flags (see FeatureFlagsContext / ProtectedRoute) —
// this only ever restricts admin/driver, so a super_admin can't accidentally
// lock themselves out of the very screen used to flip these switches back on.
export interface AdminModuleFlags {
  vehicles: boolean; // Vehicle Information page
  vehicleAssigning: boolean; // Vehicle Assigning page
  vehicleRequests: boolean; // Vehicle Requests page
  drivers: boolean; // Drivers management page
}

export interface DriverModuleFlags {
  // Drivers currently only see the Dashboard; these gate the two
  // driver-facing content blocks that live there.
  showAssignedVehicle: boolean; // "My Assigned Vehicle" card
  showAnnouncement: boolean; // whether drivers see the announcement banner at all
}

export interface Announcement {
  enabled: boolean;
  message: string;
  // Which roles the banner is shown to, in addition to `enabled` and the
  // per-role showAnnouncement flag (for drivers).
  audience: Array<"admin" | "driver">;
}

export interface FeatureFlags {
  adminModules: AdminModuleFlags;
  driverModules: DriverModuleFlags;
  announcement: Announcement;
  updatedAt?: any;
  updatedByName?: string | null;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  adminModules: {
    vehicles: true,
    vehicleAssigning: true,
    vehicleRequests: true,
    drivers: true,
  },
  driverModules: {
    showAssignedVehicle: true,
    showAnnouncement: true,
  },
  announcement: {
    enabled: false,
    message: "",
    audience: ["admin", "driver"],
  },
};

// Firestore doc that stores the flags above.
export const FEATURE_FLAGS_DOC_PATH = ["settings", "featureFlags"] as const;

/* ───────────────────────── Vehicles ───────────────────────── */

// Mirrors Modules/Vehicle/Models/Vehicle.php. Note: no "photo" field —
// this app intentionally has no image upload feature (Firestore free tier only).
export interface Vehicle {
  id: string;
  plateNumber: string;
  chassisNumber: string;
  engineNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  odometer: number;
  vehicleType?: string | null;
  fuelType?: string | null;
  // Permanent driver assignment (Vehicle Assigning feature). A vehicle has at
  // most one permanently assigned driver, and a driver is assigned to at most
  // one vehicle at a time. This is the default driver for the vehicle — future
  // work will let an admin/super_admin override the driver on a per-request
  // basis (e.g. when the assigned driver is unavailable) without changing
  // this permanent assignment.
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

/* ───────────────────────── Vehicle Requests ───────────────────────── */

// Staff have no accounts, so a request is submitted anonymously (e.g. via a
// QR code that opens the public request form) and only becomes tied to a
// driver/vehicle/admin once an admin reviews and confirms it.
export type VehicleRequestStatus = "pending" | "approved" | "declined";

export interface VehicleRequest {
  id: string;
  requesterName: string;
  // One of the MIMAROPA-region locations in src/data — see LOCATIONS in
  // RequestVehicle.tsx. Plain string for now; not yet tied to `OFFICES`.
  location?: string | null;
  requesterOffice?: string | null;
  requesterContact?: string | null;
  vehicleId: string;
  vehiclePlateNumber: string;
  // The vehicle's permanent driver at the time of the request (from Vehicle
  // Assigning). Kept as a snapshot so it doesn't silently change if the
  // permanent assignment is edited after the request was submitted.
  defaultDriverId?: string | null;
  defaultDriverName?: string | null;
  // Set by the admin at confirmation time — equals defaultDriverId unless the
  // default driver is unavailable and a substitute is chosen. This is a
  // one-off override; it never modifies the vehicle's permanent assignment.
  confirmedDriverId?: string | null;
  confirmedDriverName?: string | null;
  purpose: string;
  destination: string;
  travelDate: string; // yyyy-mm-dd — start date (single-day trips use only this)
  travelDateEnd?: string | null; // yyyy-mm-dd — end date, only set for multi-day trips
  // Whether the requester themself is riding along on the trip (vs. just
  // submitting the request on someone else's behalf). Drives whether their
  // name appears as a passenger on the printed trip ticket.
  requesterIsPassenger?: boolean;
  passengers?: string[] | null;
  // Date of the requester's previous Driver's Trip Ticket, if any — carried
  // over onto the printed trip ticket (Appendix A, item 7).
  previousTripTicketDate?: string | null;
  status: VehicleRequestStatus;
  declineReason?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}
