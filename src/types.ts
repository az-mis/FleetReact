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
  birthDate?: string | null; // yyyy-mm-dd, drivers only
  address?: string | null; // drivers only
  licenseExpirationDate?: string | null; // yyyy-mm-dd, drivers only
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

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
  passengers?: string | null;
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
