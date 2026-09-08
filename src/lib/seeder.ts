import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { OFFICES } from "../data/offices";
import { VehicleRequestStatus } from "../types";

const PHILIPPINE_FIRST_NAMES = [
  "Juan", "Jose", "Maria", "Mark", "John", "Angelo", "Christian", "Paolo", "Eduardo", "Ramon",
  "Rodrigo", "Gabriel", "Lito", "Danilo", "Arnel", "Ferdinand", "Renato", "Vicente", "Rolando", "Antonio",
  "Efren", "Manuel", "Ernesto", "Jaime", "Salvador", "Ricardo", "Domingo", "Alfredo", "Romeo", "Gregorio",
  "Arturo", "Crisanto", "Emilio", "Felipe", "Gerardo", "Hermogenes", "Ignacio", "Joaquin", "Leopoldo", "Mariano",
  "Nestor", "Orlando", "Patricio", "Quintin", "Raymundo", "Severino", "Teodoro", "Urbano", "Valentin", "Wilfredo",
  "Ana", "Rosa", "Elena", "Teresa", "Carmela", "Luzviminda", "Corazon", "Imelda", "Lourdes", "Rosario",
  "Estrella", "Consuelo", "Milagros", "Remedios", "Socorro", "Fe", "Esperanza", "Gloria", "Victoria", "Perla",
  "Aurora", "Cynthia", "Divina", "Evangeline", "Flordeliza", "Gemma", "Hazel", "Irene", "Jocelyn", "Kristine",
  "Leilani", "Maricel", "Nenita", "Ofelia", "Priscilla", "Rowena", "Sheryl", "Trinidad", "Vilma", "Zenaida",
  "Benigno", "Cesar", "Dante", "Edgar", "Felix", "Gilbert", "Hector", "Isidro", "Joel", "Karlo"
];

const PHILIPPINE_LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Torres", "Tomas", "Andrada",
  "Castillo", "Flores", "Villanueva", "Ramos", "Castro", "Rivera", "Aquino", "Navarro", "Salazar", "Mercado",
  "De la Cruz", "Del Rosario", "Domingo", "Pascual", "Soriano", "Perez", "Tolentino", "Morales", "Hernandez", "Santiago",
  "Estrada", "Gomez", "Valdez", "Aguilar", "Cortez", "Guzman", "Pineda", "Velasco", "Manalo", "San Jose",
  "Alcantara", "Bernardo", "Calderon", "Dela Rosa", "Enriquez", "Fajardo", "Galang", "Hermoso", "Ilagan", "Javier",
  "Lacsamana", "Macaraeg", "Natividad", "Ortega", "Pangilinan", "Quizon", "Resurreccion", "Samson", "Tañada", "Umali",
  "Valencia", "Yambao", "Zamora", "Abad", "Beltran", "Cariño", "Dimatulac", "Evangelista", "Fernando", "Guerrero",
  "Hilario", "Inocencio", "Jimenez", "Katigbak", "Laxamana", "Magbanua", "Nolasco", "Osorio", "Padilla", "Quicho",
  "Robles", "Serrano", "Tinio", "Untalan", "Vergara", "Yap", "Zulueta", "Abueg", "Balagtas", "Catacutan"
];

const LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
];

const VEHICLE_MODELS = [
  { brand: "Toyota", model: "Hilux 4x4", type: "Pickup Truck", fuel: "Diesel" },
  { brand: "Isuzu", model: "D-Max 3.0", type: "Pickup Truck", fuel: "Diesel" },
  { brand: "Ford", model: "Ranger Raptor 4x4", type: "Pickup Truck", fuel: "Diesel" },
  { brand: "Nissan", model: "Navara VL 4x4", type: "Pickup Truck", fuel: "Diesel" },
  { brand: "Toyota", model: "HiAce Commuter Grandia", type: "Van", fuel: "Diesel" },
  { brand: "Nissan", model: "Urvan NV350", type: "Van", fuel: "Diesel" },
  { brand: "Mitsubishi", model: "Montero Sport 4WD", type: "SUV", fuel: "Diesel" },
  { brand: "Toyota", model: "Fortuner 2.8 4x4", type: "SUV", fuel: "Diesel" },
  { brand: "Mitsubishi", model: "L300 FB Exceed", type: "Utility Van", fuel: "Diesel" },
  { brand: "Toyota", model: "Innova 2.8 E", type: "MPV", fuel: "Diesel" },
  { brand: "Ford", model: "F-150 Lariat 4x4", type: "Pickup Truck", fuel: "Gasoline" },
  { brand: "Ford", model: "Everest Titanium+ 4x4", type: "SUV", fuel: "Diesel" },
  { brand: "Suzuki", model: "Jimny AllGrip 4x4", type: "Mini SUV", fuel: "Gasoline" },
  { brand: "Toyota", model: "Corolla Cross HEV", type: "Crossover", fuel: "Hybrid" },
  { brand: "Isuzu", model: "Traviz L Utility", type: "Utility Truck", fuel: "Diesel" },
];

const VEHICLE_COLORS = [
  "Pearl White", "Silver Metallic", "Dark Grey", "Jet Black", "Forest Green", "Navy Blue", "Crimson Red", "Bronze"
];

const PURPOSES = [
  "Delivery of certified rice seeds and organic fertilizer to farmer cooperatives.",
  "Field validation and geo-tagging of farm-to-market road infrastructure.",
  "Conducting training on high-value crop production and pest management.",
  "Official monitoring and evaluation of DA-assisted cold storage facilities.",
  "Distribution of livestock breeding stocks and veterinary medicines.",
  "Rapid damage assessment following recent heavy rainfall and weather disturbance.",
  "Attendance in Regional Agricultural and Fishery Council (RAFC) coordination meeting.",
  "Soil sampling collection and nutrient analysis for crop suitability mapping.",
  "Technical inspection of solar-powered irrigation system (SPIS) installation.",
  "Registry System for Basic Sectors in Agriculture (RSBSA) farmer registration drive."
];

const DESTINATIONS = [
  "Calapan City & Naujan Research Center, Oriental Mindoro",
  "San Jose & Magsaysay Agricultural Complex, Occidental Mindoro",
  "Boac & Gasan Farmer Multi-Purpose Centers, Marinduque",
  "Puerto Princesa City & Brooke's Point Experiment Station, Palawan",
  "Odiongan & Romblon Agro-Trading Hubs, Romblon",
  "Victoria & Socorro Rice Demonstration Fields, Oriental Mindoro",
  "Sablayan Prison and Penal Farm Agricultural Project, Occidental Mindoro",
  "Roxas Municipal Agriculture Office & Port Terminal, Oriental Mindoro",
  "Coron & Busuanga Island Agrarian Communities, Palawan",
  "DA Central Office & Regional Satellite Complex, Quezon City"
];

const DECLINE_REASONS = [
  "Requested vehicle has conflicting priority schedule for emergency relief deployment.",
  "Vehicle scheduled for routine 50,000-km preventive maintenance on the requested travel date.",
  "Lack of available designated driver; please coordinate with GSS for pooled scheduling.",
  "Destination road conditions inaccessible for non-4x4 utility vehicle.",
  "Official travel order document attachment requires further division head endorsement."
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePlateNumber(index: number): string {
  const letters = ["SAA", "SAB", "NBC", "NBD", "NDB", "DAF", "DAN", "DAM", "DAP", "DAR"];
  const prefix = letters[index % letters.length];
  const num = 1000 + ((index * 37 + 13) % 9000);
  return `${prefix} ${num}`;
}

function generateVIN(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let vin = "6FMM";
  for (let i = 0; i < 13; i++) {
    vin += chars[Math.floor(Math.random() * chars.length)];
  }
  return vin;
}

function generateEngineNumber(): string {
  const prefixes = ["2GD", "1GD", "4JJ3", "2TR", "4N15", "YD25", "EcoBoost"];
  return `${randomChoice(prefixes)}-${randomInt(100000, 999999)}`;
}

export async function seed100Records(onProgress?: (msg: string) => void) {
  onProgress?.("Generating 100 Drivers...");

  // 1. Generate 100 Drivers
  const seededDrivers: { id: string; name: string; email: string }[] = [];
  const driverDocs: any[] = [];

  for (let i = 1; i <= 100; i++) {
    const firstName = PHILIPPINE_FIRST_NAMES[(i * 3 + 7) % PHILIPPINE_FIRST_NAMES.length];
    const lastName = PHILIPPINE_LAST_NAMES[(i * 5 + 11) % PHILIPPINE_LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const driverId = `seed_driver_${String(i).padStart(3, "0")}`;
    const email = `driver.${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@da.gov.ph`.replace(/\s+/g, "");

    const birthYear = randomInt(1972, 1999);
    const birthMonth = String(randomInt(1, 12)).padStart(2, "0");
    const birthDay = String(randomInt(1, 28)).padStart(2, "0");

    const expiryYear = randomInt(2025, 2030);
    const expiryMonth = String(randomInt(1, 12)).padStart(2, "0");
    const expiryDay = String(randomInt(1, 28)).padStart(2, "0");

    const address = `${randomChoice(["Brgy. Lumangbayan", "Brgy. San Vicente", "Brgy. Santa Isabel", "Brgy. Poblacion", "Brgy. Bagong Bayan"])}, ${randomChoice(LOCATIONS)}`;

    seededDrivers.push({ id: driverId, name: fullName, email });
    driverDocs.push({
      id: driverId,
      name: fullName,
      email,
      role: "driver",
      photoURL: null,
      photoDriveFileId: null,
      birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
      address,
      licenseExpirationDate: `${expiryYear}-${expiryMonth}-${expiryDay}`,
      isSeeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 2. Generate 100 Vehicles
  onProgress?.("Generating 100 Vehicles & Driver Assignments...");
  const seededVehicles: { id: string; plateNumber: string; assignedDriverId?: string; assignedDriverName?: string }[] = [];
  const vehicleDocs: any[] = [];

  for (let i = 1; i <= 100; i++) {
    const vModel = VEHICLE_MODELS[(i - 1) % VEHICLE_MODELS.length];
    const vehicleId = `seed_veh_${String(i).padStart(3, "0")}`;
    const plateNumber = generatePlateNumber(i);
    const assignedDriver = seededDrivers[i - 1]; // 1-to-1 permanent assignment

    seededVehicles.push({
      id: vehicleId,
      plateNumber,
      assignedDriverId: assignedDriver.id,
      assignedDriverName: assignedDriver.name,
    });

    vehicleDocs.push({
      id: vehicleId,
      plateNumber,
      chassisNumber: generateVIN(),
      engineNumber: generateEngineNumber(),
      brand: vModel.brand,
      model: vModel.model,
      year: randomInt(2018, 2024),
      color: randomChoice(VEHICLE_COLORS),
      odometer: randomInt(8000, 125000),
      vehicleType: vModel.type,
      fuelType: vModel.fuel,
      photoURL: null,
      photoDriveFileId: null,
      assignedDriverId: assignedDriver.id,
      assignedDriverName: assignedDriver.name,
      isSeeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 3. Generate 100 Vehicle Requests (Mixed Statuses: 45 Pending, 40 Approved, 15 Declined)
  onProgress?.("Generating 100 Vehicle Requests in various statuses...");
  const requestDocs: any[] = [];
  const availabilityDocs: any[] = [];

  // Distribution:
  // 1-45: Pending
  // 46-85: Approved
  // 86-100: Declined
  for (let i = 1; i <= 100; i++) {
    const requestId = `seed_req_${String(i).padStart(3, "0")}`;
    const reqFirstName = PHILIPPINE_FIRST_NAMES[(i * 7 + 13) % PHILIPPINE_FIRST_NAMES.length];
    const reqLastName = PHILIPPINE_LAST_NAMES[(i * 9 + 17) % PHILIPPINE_LAST_NAMES.length];
    const requesterName = `${reqFirstName} ${reqLastName}`;
    const office = randomChoice(OFFICES).label;
    const location = randomChoice(LOCATIONS);

    const vehicle = seededVehicles[(i * 3) % seededVehicles.length];
    const assignedDriver = seededDrivers[(i * 3) % seededDrivers.length];

    let status: VehicleRequestStatus = "pending";
    if (i > 45 && i <= 85) status = "approved";
    if (i > 85) status = "declined";

    // Spread travel dates across recent past to upcoming months
    const dayOffset = (i * 2) - 40; // -38 to +160 days
    const tripStartDate = new Date();
    tripStartDate.setDate(tripStartDate.getDate() + dayOffset);
    const startStr = tripStartDate.toISOString().split("T")[0];

    // Some multi-day trips
    let endStr: string | null = null;
    if (i % 4 === 0) {
      const tripEndDate = new Date(tripStartDate);
      tripEndDate.setDate(tripEndDate.getDate() + randomInt(1, 3));
      endStr = tripEndDate.toISOString().split("T")[0];
    }

    const passengerCount = randomInt(0, 4);
    const passengers: string[] = [];
    for (let p = 0; p < passengerCount; p++) {
      passengers.push(
        `${PHILIPPINE_FIRST_NAMES[(i + p * 4) % PHILIPPINE_FIRST_NAMES.length]} ${
          PHILIPPINE_LAST_NAMES[(i + p * 6) % PHILIPPINE_LAST_NAMES.length]
        }`
      );
    }

    const purpose = randomChoice(PURPOSES);
    const destination = randomChoice(DESTINATIONS);

    const reqData: any = {
      id: requestId,
      requesterName,
      location,
      requesterOffice: office,
      requesterContact: `09${randomInt(10, 99)}${randomInt(1000000, 9999999)}`,
      requesterIsPassenger: i % 2 === 0,
      vehicleId: vehicle.id,
      vehiclePlateNumber: vehicle.plateNumber,
      defaultDriverId: vehicle.assignedDriverId || null,
      defaultDriverName: vehicle.assignedDriverName || null,
      confirmedDriverId: status === "approved" ? vehicle.assignedDriverId || assignedDriver.id : null,
      confirmedDriverName: status === "approved" ? vehicle.assignedDriverName || assignedDriver.name : null,
      purpose,
      destination,
      travelDate: startStr,
      travelDateEnd: endStr,
      passengers: passengers.length > 0 ? passengers : null,
      previousTripTicketDate: null,
      status,
      declineReason: status === "declined" ? randomChoice(DECLINE_REASONS) : null,
      approvedBy: status === "approved" ? "super_admin_seed" : null,
      approvedByName: status === "approved" ? "Engr. Regional Admin" : null,
      approvedAt: status === "approved" ? serverTimestamp() : null,
      isSeeded: true,
      createdAt: Timestamp.fromDate(new Date(Date.now() - (100 - i) * 3600000 * 4)),
      updatedAt: serverTimestamp(),
    };

    requestDocs.push(reqData);

    if (status === "pending" || status === "approved") {
      availabilityDocs.push({
        id: requestId,
        vehicleId: vehicle.id,
        travelDate: startStr,
        travelDateEnd: endStr,
        status,
        isSeeded: true,
      });
    }
  }

  // 4. Commit all records to Firestore in Batches
  onProgress?.("Writing Drivers to database...");
  await commitInBatches("users", driverDocs);

  onProgress?.("Writing Vehicles to database...");
  await commitInBatches("vehicles", vehicleDocs);

  onProgress?.("Writing Vehicle Requests to database...");
  await commitInBatches("vehicleRequests", requestDocs);

  onProgress?.("Writing Vehicle Availability to database...");
  await commitInBatches("vehicleAvailability", availabilityDocs);

  onProgress?.("100 records successfully seeded!");
}

async function commitInBatches(collectionName: string, items: any[]) {
  const BATCH_SIZE = 100;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, item, { merge: true });
    }
    await batch.commit();
  }
}

export async function clearSeededRecords(onProgress?: (msg: string) => void) {
  onProgress?.("Locating seeded records across collections...");

  const collectionsToClean = ["users", "vehicles", "vehicleRequests", "vehicleAvailability"];

  for (const colName of collectionsToClean) {
    onProgress?.(`Clearing dummy records from ${colName}...`);
    const q = query(collection(db, colName), where("isSeeded", "==", true));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docsToDelete = snap.docs;
      const BATCH_SIZE = 100;
      for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
        const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }

  onProgress?.("All seeded records cleared.");
}
