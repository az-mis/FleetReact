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
  createdAt?: any;
  updatedAt?: any;
}
