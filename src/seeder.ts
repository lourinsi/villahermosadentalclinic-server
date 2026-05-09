#!/usr/bin/env ts-node
// Seeder script to populate the database with random dummy data
// Run with: npm run seed

import { Patient } from "./types/patient";
import bcrypt from "bcryptjs";
import { Appointment } from "./types/appointment";
import { Staff } from "./types/staff";
import { InventoryItem } from "./types/inventory";
import { FinanceRecord } from "./types/finance";
import { PaymentMethod } from "./types/paymentMethod";
import { Notification } from "./types/notification";
import { NotificationType } from "./shared/notificationStatuses";
import { APPOINTMENT_TYPES, getAppointmentTypeName } from "./shared/appointmentTypes";
import { APPOINTMENT_STATUSES } from "./shared/appointmentStatuses";
import { PAYMENT_STATUSES } from "./shared/paymentStatuses";
import { 
  createNotification, 
  updateOrCreateNotificationForAppointment,
  createStatusChangeNotification,
  notifyStatusChange 
} from "./utils/notifications";

// Sample data for seeding
let authToken: string | null = null;

async function loginAsAdmin() {
  try {
    console.log("🔐 Logging in as admin...");
    const response = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "password" }),
    });
    const result = await response.json();
    if (result.success && result.token) {
      authToken = result.token;
      console.log("✅ Admin login successful\n");
      return true;
    }
    console.error("❌ Admin login failed:", result.message);
    return false;
  } catch (err) {
    console.error("❌ Admin login error:", err);
    return false;
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers as any,
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return fetch(url, { ...options, headers });
}

const firstNames = [
  "Sarah",
  "Michael",
  "Emily",
  "David",
  "Jessica",
  "Robert",
  "Jennifer",
  "William",
  "Lisa",
  "James",
  "Maria",
  "Richard",
  "Patricia",
  "Thomas",
  "Angela",
  "Charles",
  "Mary",
  "Christopher",
  "Nancy",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
];


const statuses = ["active", "inactive"];

const insurances = ["Blue Cross", "Aetna", "Delta Dental", "Cigna", "United Healthcare", "None"];

// PaymentStatus type - matches Appointment.paymentStatus type
type PaymentStatus = "paid" | "unpaid" | "overdue" | "half-paid" | "over-paid";

const inventoryItemsData: Omit<InventoryItem, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [
  { item: "Dental Anesthetic (Lidocaine)", quantity: 45, unit: "vials", costPerUnit: 12.50, totalValue: 562.50, supplier: "DentMed Supply", lastOrdered: "2024-01-15" },
  { item: "Composite Filling Material", quantity: 12, unit: "tubes", costPerUnit: 85.00, totalValue: 1020.00, supplier: "3M Dental", lastOrdered: "2024-01-10" },
  { item: "Disposable Gloves (Nitrile)", quantity: 8, unit: "boxes", costPerUnit: 24.99, totalValue: 199.92, supplier: "MedStock", lastOrdered: "2024-01-18" },
  { item: "Dental Impression Material", quantity: 20, unit: "cartridges", costPerUnit: 35.00, totalValue: 700.00, supplier: "Dentsply", lastOrdered: "2024-01-12" },
  { item: "X-Ray Film", quantity: 15, unit: "packs", costPerUnit: 45.00, totalValue: 675.00, supplier: "Kodak Dental", lastOrdered: "2024-01-08" },
  { item: "Sterilization Pouches", quantity: 50, unit: "boxes", costPerUnit: 18.00, totalValue: 900.00, supplier: "SterileMax", lastOrdered: "2024-01-20" },
  { item: "Prophy Paste", quantity: 30, unit: "cups", costPerUnit: 0.75, totalValue: 22.50, supplier: "Hu-Friedy", lastOrdered: "2024-01-22" },
  { item: "Scaler Tips", quantity: 5, unit: "pieces", costPerUnit: 120.00, totalValue: 600.00, supplier: "EMS Dental", lastOrdered: "2024-01-25" },
];

const staffMembersData: Omit<Staff, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [
  {
    name: "Dr. Test Doctor",
    role: "Lead Dentist",
    department: "Dentistry",
    email: "test.doctor@villahermosa.com",
    phone: "+1 (555) 000-0000",
    hireDate: "2024-01-01",
    baseSalary: 15000,
    status: "active",
    employmentType: "Full-time",
    specialization: "General Dentistry",
    licenseNumber: "DDS-00000",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/men/41.jpg",
    bio: "Test doctor for system validation."
  },
  {
    name: "Dr. Sarah Johnson",
    role: "Lead Dentist",
    department: "Dentistry",
    email: "sarah.johnson@smilecare.com",
    phone: "+1 (555) 123-4567",
    hireDate: "2019-03-15",
    baseSalary: 12000,
    status: "active",
    employmentType: "Full-time",
    specialization: "General Dentistry",
    licenseNumber: "DDS-12345",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/women/68.jpg",
    bio: "Dr. Villahermosa has over 15 years of experience in general dentistry, focusing on preventive care and patient education."
  },
  {
    name: "Dr. Michael Chen",
    role: "Associate Dentist",
    department: "Dentistry",
    email: "michael.chen@smilecare.com",
    phone: "+1 (555) 234-5678",
    hireDate: "2020-06-01",
    baseSalary: 9000,
    status: "active",
    employmentType: "Full-time",
    specialization: "Orthodontics",
    licenseNumber: "DDS-23456",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/men/75.jpg",
    bio: "Dr. Chen specializes in orthodontics and is passionate about creating beautiful smiles using the latest technology."
  },
  {
    name: "Dr. Emily Rodriguez",
    role: "Pediatric Dentist",
    department: "Dentistry",
    email: "emily.rodriguez@smilecare.com",
    phone: "+1 (555) 345-6789",
    hireDate: "2021-01-10",
    baseSalary: 8500,
    status: "active",
    employmentType: "Full-time",
    specialization: "Pediatric Dentistry",
    licenseNumber: "DDS-34567",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/women/65.jpg",
    bio: "Dr. Rodriguez loves working with children and aims to provide a comfortable and fun dental experience for her young patients."
  },
  {
    name: "Jessica Williams",
    role: "Dental Hygienist",
    department: "Hygiene",
    email: "jessica.williams@smilecare.com",
    phone: "+1 (555) 456-7890",
    hireDate: "2020-09-20",
    baseSalary: 4500,
    status: "active",
    employmentType: "Full-time",
    specialization: "Dental Hygiene",
    licenseNumber: "RDH-45678",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  {
    name: "Mark Thompson",
    role: "Dental Assistant",
    department: "Assistance",
    email: "mark.thompson@smilecare.com",
    phone: "+1 (555) 567-8901",
    hireDate: "2022-02-14",
    baseSalary: 3200,
    status: "active",
    employmentType: "Full-time",
    specialization: "Chair-side Assistance",
    licenseNumber: "DA-56789",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/men/32.jpg"
  },
  {
    name: "Lisa Martinez",
    role: "Office Manager",
    department: "Administration",
    email: "lisa.martinez@smilecare.com",
    phone: "+1 (555) 678-9012",
    hireDate: "2018-11-05",
    baseSalary: 4000,
    status: "active",
    employmentType: "Full-time",
    specialization: "Office Management",
    licenseNumber: "N/A",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/women/47.jpg"
  },
  {
    name: "Robert Davis",
    role: "Receptionist",
    department: "Administration",
    email: "robert.davis@smilecare.com",
    phone: "+1 (555) 789-0123",
    hireDate: "2023-04-18",
    baseSalary: 2800,
    status: "active",
    employmentType: "Part-time",
    specialization: "Patient Relations",
    licenseNumber: "N/A",
    password: bcrypt.hashSync("doctor123", 10),
    profilePicture: "https://randomuser.me/api/portraits/men/52.jpg"
  }
];

const paymentMethodsData: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [
  { name: "Credit Card", isActive: true },
  { name: "Cash", isActive: true },
  { name: "Debit Card", isActive: true },
  { name: "Insurance", isActive: true },
  { name: "Check", isActive: true },
  { name: "Bank Transfer", isActive: true },
];

const dentistStaffMembers = staffMembersData.filter(
  (staff) => staff.role?.toLowerCase().includes("dentist")
);
const doctorNames = dentistStaffMembers.map((staff) => staff.name);

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(startDate: Date, endDate: Date): Date {
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
}

function generateRandomTimestamp(startDate: Date, endDate: Date): string {
  return getRandomDate(startDate, endDate).toISOString();
}

const toothSections = ["top", "bottom", "left", "right", "center"];
const toothColors = ["blue", "red"];

function generateRandomToothState(): Record<string, string> {
    const state: Record<string, string> = { top: "none", bottom: "none", left: "none", right: "none", center: "none" };
    const sectionsToColor = getRandomInt(1, 3);
    for (let i = 0; i < sectionsToColor; i++) {
        const randomSection = getRandomElement(toothSections);
        state[randomSection] = getRandomElement(toothColors);
    }
    return state;
}

function generateRandomDentalChartData(): string {
    const chartData: Record<number, Record<string, string>> = {};
    const adultTeeth = [
        18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
        48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
    ];
    const teethWithFindings = getRandomInt(3, 8);
    for (let i = 0; i < teethWithFindings; i++) {
        const randomTooth = getRandomElement(adultTeeth);
        if (!chartData[randomTooth]) {
            chartData[randomTooth] = generateRandomToothState();
        }
    }
    return JSON.stringify(chartData);
}

function generateDentalCharts(patientLastVisit?: string): { date: string; data: string; isEmpty: boolean }[] {
  const charts: { date: string; data: string; isEmpty: boolean }[] = [];
    if (Math.random() < 0.5) {
        return charts;
    }

    const chartCount = getRandomInt(1, 3);
    const lastDate = patientLastVisit ? new Date(patientLastVisit) : new Date();
    if (!patientLastVisit) {
        lastDate.setFullYear(lastDate.getFullYear() - getRandomInt(0, 2));
    }

    for (let i = 0; i < chartCount; i++) {
    charts.push({
      date: lastDate.toISOString().split("T")[0],
      data: generateRandomDentalChartData(),
      isEmpty: false,
    });
        lastDate.setMonth(lastDate.getMonth() - getRandomInt(6, 12));
    }

    return charts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function generatePatients(count: number = 25): Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] {
  const generatedPatients: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [];
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  // Add a specific patient for testing
  // IMPORTANT: username must match the auth user record for server-side filtering to work
  const testPatient: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
    name: "Test Patient",
    firstName: "Test",
    lastName: "Patient",
    email: "test@patient.com",
    phone: "09915341237",
    password: bcrypt.hashSync("villahermosa123", 10),
    dateOfBirth: "1990-01-01",
    address: "123 Test St",
    city: "Testville",
    zipCode: "12345",
    insurance: "None",
    status: "active",
    emergencyContact: "Test Emergency",
    emergencyPhone: "0987654321",
    allergies: "None",
    medicalHistory: "None",
    notes: "This is a test patient.",
    isPrimary: true,
    dentalCharts: [],
    lastVisit: undefined,
    username: "test@patient.com", // Match email for consistent auth
  };
  generatedPatients.push(testPatient);


  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`;
    const phone = `09${getRandomInt(10, 99)}${getRandomInt(100, 999)}${getRandomInt(1000, 9999)}`;
    const dateOfBirth = new Date(getRandomInt(1960, 2005), getRandomInt(0, 11), getRandomInt(1, 28));

    const hasLastVisit = Math.random() > 0.2;
    const randomVisitDate = getRandomDate(oneYearAgo, now);
    const lastVisitDate = hasLastVisit ? `${randomVisitDate.getFullYear()}-${(randomVisitDate.getMonth() + 1).toString().padStart(2, '0')}-${randomVisitDate.getDate().toString().padStart(2, '0')}` : undefined;
    
    const dentalCharts = generateDentalCharts(lastVisitDate);

    const patient: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email,
      phone,
      password: bcrypt.hashSync("villahermosa123", 10),
      isPrimary: true,
      dateOfBirth: dateOfBirth.toISOString().split("T")[0],
      address: `${getRandomInt(100, 9999)} ${getRandomElement(["Main", "Oak", "Elm", "Maple", "Pine", "Cedar"])} St, ${getRandomElement(["Springfield", "Shelbyville", "Capital City", "Metropolis", "Gotham"])}`,
      city: getRandomElement(["Springfield", "Shelbyville", "Capital City", "Metropolis", "Gotham"]),
      zipCode: `${getRandomInt(10000, 99999)}`,
      insurance: getRandomElement(insurances),
      status: getRandomElement(statuses),
      emergencyContact: getRandomElement(firstNames) + " " + getRandomElement(lastNames),
      emergencyPhone: `09${getRandomInt(10, 99)}${getRandomInt(100, 999)}${getRandomInt(1000, 9999)}`,
      allergies: Math.random() > 0.7 ? getRandomElement(["Penicillin", "Latex", "Iodine", "None"]) : "None",
      medicalHistory: getRandomElement(["Diabetes", "Hypertension", "Asthma", "None"]),
      notes: getRandomElement(["VIP patient", "Referred by friend", "Online inquiry", ""]),
      dentalCharts: dentalCharts,
      lastVisit: lastVisitDate,
      username: email, // Use email as username for consistency
    };

    generatedPatients.push(patient);
  }

  return generatedPatients;
}

function generateDependents(parent: Patient, count: number): Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] {
  const dependents: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [];
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = parent.lastName || getRandomElement(lastNames);
    const relationship = getRandomElement(["Spouse", "Child", "Parent", "Sibling"]);
    const dateOfBirth = new Date(getRandomInt(1970, 2020), getRandomInt(0, 11), getRandomInt(1, 28));
    
    const hasLastVisit = Math.random() > 0.5;
    const randomVisitDate = getRandomDate(oneYearAgo, now);
    const lastVisitDate = hasLastVisit ? `${randomVisitDate.getFullYear()}-${(randomVisitDate.getMonth() + 1).toString().padStart(2, '0')}-${randomVisitDate.getDate().toString().padStart(2, '0')}` : undefined;
    
    const dentalCharts = generateDentalCharts(lastVisitDate);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}_dep@email.com`;

    dependents.push({
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: parent.email, // Inherited contact
      phone: parent.phone, // Inherited contact
      parentId: parent.id,
      isPrimary: false,
      relationship,
      dateOfBirth: dateOfBirth.toISOString().split("T")[0],
      address: parent.address,
      city: parent.city,
      zipCode: parent.zipCode,
      insurance: parent.insurance,
      status: "active",
      emergencyContact: parent.name,
      emergencyPhone: parent.phone,
      allergies: Math.random() > 0.8 ? getRandomElement(["Penicillin", "Latex", "Iodine", "None"]) : "None",
      notes: `Dependent of ${parent.name}`,
      dentalCharts: dentalCharts,
      lastVisit: lastVisitDate,
      username: email, // Set username for dependents too
    });
  }
  return dependents;
}

function generateAppointments(patientsList: Patient[], doctorsList: string[], count: number = 60): Omit<Appointment, "id" | "deleted" | "deletedAt">[] {
  const generatedAppointments: Omit<Appointment, "id" | "deleted" | "deletedAt">[] = [];
  const now = new Date();
  const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  
  // For randomizing timestamps: go back 6 months for appointment creation times
  const createdAtStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const createdAtEnd = now;

  // Duration options: only 30, 60, 90, 120 (no 45!)
  const VALID_DURATIONS = [30, 60, 90, 120];

  // Helper: Get duration for appointment type (updated to use valid durations)
  const getDurationForType = (typeIndex: number): number => {
    const durations: Record<number, number> = {
      0: 30,  // Routine Cleaning
      1: 30,  // Checkup
      2: 60,  // Filling
      3: 90,  // Root Canal
      4: 60,  // Extraction
      5: 120, // Whitening
      6: 30,  // Other
    };
    return durations[typeIndex] || 30;
  };

  // Helper: Check if two time slots overlap
  const slotsOverlap = (
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean => {
    return start1 < end2 && end1 > start2;
  };

  // Helper: Get appointment end time
  const getAppointmentEnd = (apt: Omit<Appointment, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">): Date => {
    const [hours, minutes] = apt.time.split(':').map(Number);
    const start = new Date(apt.date);
    start.setHours(hours, minutes, 0, 0);
    return new Date(start.getTime() + (apt.duration || 30) * 60000);
  };

  // First, create past appointments (completed/scheduled) for each patient's lastVisit
  patientsList.forEach(patient => {
    if (patient.lastVisit) {
      const pastPriceOptions = [1500, 500, 1200, 5000, 1500, 3000];
      const appointmentTypeIndex = getRandomInt(0, APPOINTMENT_TYPES.length - 2);
      const price = pastPriceOptions[appointmentTypeIndex] || 1000;
      const duration = getDurationForType(appointmentTypeIndex);
      
      // Randomize createdAt/updatedAt within 6 months ago to now
      const appointmentCreatedAt = new Date(generateRandomTimestamp(createdAtStart, createdAtEnd));
      
      generatedAppointments.push({
        patientId: patient.id || "",
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: patient.lastVisit,
        time: `${String(getRandomInt(8, 17)).padStart(2, "0")}:${String(getRandomElement([0, 30])).padStart(2, "0")}`,
        type: appointmentTypeIndex,
        duration: duration,
        doctor: doctorsList.length > 0 ? getRandomElement(doctorsList) : "",
        price: price,
        status: APPOINTMENT_STATUSES.find(s => s.value === "completed")?.value || "completed",
        paymentStatus: "paid",
        balance: 0,
        totalPaid: price,
        notes: "Routine visit completed.",
        createdAt: appointmentCreatedAt,
        updatedAt: appointmentCreatedAt,
      });
    }
  });

  // Add specific test patient appointments with realistic scenario
  const testPatient = patientsList.find(p => p.email === "test@patient.com");
  const testDoctorName = "Dr. Test Doctor";
  
  if (testPatient) {
    // === SCENARIO 1: AUDIT TRAIL - Shows all 3 roles making updates ===
    // Step 1: Patient creates appointment on April 18, 2026 at 18:00 (60 mins)
    //         - Status: reserved, Payment: half-paid (500 of 1500)
    const auditTrailCreateTime = new Date("2026-04-18T07:14:53.009Z");
    const auditTrailCreateLogTime = new Date("2026-04-18T07:14:53.034Z");
    
    generatedAppointments.push({
      patientId: testPatient.id || "",
      patientName: testPatient.name,
      date: "2026-04-18",
      time: "18:00",
      type: 4, // Extraction type
      duration: 60, // 18:00 - 19:00
      doctor: testDoctorName,
      price: 1500,
      status: APPOINTMENT_STATUSES.find(s => s.value === "reserved")?.value || "reserved",
      paymentStatus: "half-paid",
      balance: 1000,
      totalPaid: 500,
      notes: "Audit trail: shows updates from patient, doctor, and admin roles.",
      createdAt: auditTrailCreateTime,
      updatedAt: auditTrailCreateTime, // Updated when doctor processes payment
    });

    // === SCENARIO 2: Permanent scheduled appointment (baseline) ===
    // This is a complete, paid appointment for comparison
    const permanentAptCreatedAt = new Date("2026-04-15T10:00:00.000Z");
    generatedAppointments.push({
      patientId: testPatient.id || "",
      patientName: testPatient.name,
      date: "2026-04-15",
      time: "10:00",
      type: 1, // Checkup
      duration: 60, // 10:00 - 11:00
      doctor: testDoctorName,
      price: 1500,
      status: APPOINTMENT_STATUSES.find(s => s.value === "scheduled")?.value || "scheduled",
      paymentStatus: "paid",
      balance: 0,
      totalPaid: 1500,
      notes: "Baseline scheduled appointment - fully paid from creation.",
      createdAt: permanentAptCreatedAt,
      updatedAt: permanentAptCreatedAt,
    });

    // === SCENARIO 3: Reserved with partial payment ===
    // Patient books and pays some, waiting for doctor approval
    const reservedAptCreatedAt = new Date("2026-04-20T08:30:00.000Z");
    generatedAppointments.push({
      patientId: testPatient.id || "",
      patientName: testPatient.name,
      date: "2026-04-20",
      time: "14:00",
      type: 0, // Routine Cleaning
      duration: 30,
      doctor: testDoctorName,
      price: 1500,
      status: APPOINTMENT_STATUSES.find(s => s.value === "reserved")?.value || "reserved",
      paymentStatus: "half-paid",
      balance: 1000,
      totalPaid: 500,
      notes: "Reserved appointment with partial payment awaiting doctor confirmation.",
      createdAt: reservedAptCreatedAt,
      updatedAt: reservedAptCreatedAt,
    });

    // === SCENARIO 4: Tentative appointment (pending decision) ===
    // Patient tentatively booked, payment decision pending
    const tentativeAptCreatedAt = new Date("2026-04-22T09:15:00.000Z");
    generatedAppointments.push({
      patientId: testPatient.id || "",
      patientName: testPatient.name,
      date: "2026-04-22",
      time: "09:00",
      type: 3, // Root Canal
      duration: 90,
      doctor: testDoctorName,
      price: 5000,
      status: APPOINTMENT_STATUSES.find(s => s.value === "tentative")?.value || "tentative",
      paymentStatus: "unpaid",
      balance: 5000,
      totalPaid: 0,
      notes: "Tentative appointment awaiting patient payment confirmation.",
      createdAt: tentativeAptCreatedAt,
      updatedAt: tentativeAptCreatedAt,
    });

    // === SCENARIO 5: Completed appointment (fully paid) ===
    // Past appointment that has been completed
    const completedAptCreatedAt = new Date("2026-04-10T11:00:00.000Z");
    generatedAppointments.push({
      patientId: testPatient.id || "",
      patientName: testPatient.name,
      date: "2026-04-10",
      time: "11:30",
      type: 1, // Checkup
      duration: 30,
      doctor: testDoctorName,
      price: 500,
      status: APPOINTMENT_STATUSES.find(s => s.value === "completed")?.value || "completed",
      paymentStatus: "paid",
      balance: 0,
      totalPaid: 500,
      notes: "Past appointment - completed and fully paid.",
      createdAt: completedAptCreatedAt,
      updatedAt: completedAptCreatedAt,
    });
  }

  // Generate remaining random appointments
  const remainingCount = Math.max(0, count - generatedAppointments.length);
  
  // Track doctor schedules to avoid random conflicts
  const doctorSchedule: Record<string, Array<{ date: string; start: Date; end: Date }>> = {};
  
  // Initialize doctor schedules from already-generated appointments
  generatedAppointments.forEach(apt => {
    if (!doctorSchedule[apt.doctor]) {
      doctorSchedule[apt.doctor] = [];
    }
    const [hours, minutes] = apt.time.split(':').map(Number);
    const start = new Date(apt.date);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + (apt.duration || 30) * 60000);
    
    if (apt.status !== "cancelled" && apt.status !== "pending") {
      doctorSchedule[apt.doctor].push({ date: apt.date, start, end });
    }
  });

  for (let i = 0; i < remainingCount; i++) {
    const patient = getRandomElement(patientsList);
    const isPast = Math.random() > 0.8;
    const appointmentDate = isPast ? getRandomDate(oneYearAgo, now) : getRandomDate(now, sixMonthsLater);
    const hour = getRandomInt(8, 17);
    const minute = getRandomElement([0, 30]);
    const appointmentTypeIndex = getRandomInt(0, APPOINTMENT_TYPES.length - 1);
    const customType = appointmentTypeIndex === 6 ? "Custom user-defined procedure" : undefined;
    const duration = getDurationForType(appointmentTypeIndex);

    // Smart status assignment
    let statusValue: string;
    if (isPast) {
      statusValue = Math.random() > 0.1 ? "completed" : "scheduled";
    } else {
      const statusOptions = ["scheduled", "reserved", "pending"];
      statusValue = getRandomElement(statusOptions);
    }

    let paymentStatus: PaymentStatus = "unpaid";
    if (isPast && statusValue === "completed") {
      paymentStatus = "paid";
    } else if (statusValue === "reserved") {
      paymentStatus = "half-paid";
    } else if (statusValue === "scheduled" && !isPast) {
      paymentStatus = Math.random() > 0.5 ? "paid" : "unpaid";
    }

    const price = [1500, 500, 1200, 5000, 1500, 3000][getRandomInt(0, 5)] || 1000;
    let totalPaid = 0;
    if (paymentStatus === "paid") totalPaid = price;
    else if (paymentStatus === "half-paid") totalPaid = Math.floor(price / 2);

    const balance = price - totalPaid;
    const doctor = doctorsList.length > 0 ? getRandomElement(doctorsList) : "";
    const dateStr = `${appointmentDate.getFullYear()}-${(appointmentDate.getMonth() + 1).toString().padStart(2, '0')}-${appointmentDate.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    // Check for conflicts with doctor schedule
    const [hours, mins] = timeStr.split(':').map(Number);
    const slotStart = new Date(dateStr);
    slotStart.setHours(hours, mins, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

    let hasConflict = false;
    if (doctorSchedule[doctor]) {
      hasConflict = doctorSchedule[doctor].some(scheduled => 
        scheduled.date === dateStr && slotsOverlap(slotStart, slotEnd, scheduled.start, scheduled.end)
      );
    }

    if (hasConflict && statusValue !== "pending") {
      // Skip this appointment to avoid conflict
      continue;
    }

    const appointment: Omit<Appointment, "id" | "deleted" | "deletedAt"> = {
      patientId: patient.id || "",
      patientName: `${patient.firstName} ${patient.lastName}`,
      date: dateStr,
      time: timeStr,
      type: appointmentTypeIndex,
      customType: customType,
      duration: duration,
      doctor: doctor,
      price: price,
      status: statusValue,
      paymentStatus: paymentStatus,
      totalPaid: totalPaid,
      balance: balance,
      notes: getRandomElement([
        "Routine cleaning and checkup",
        "Follow-up from previous visit",
        "New patient evaluation",
        "Crown placement",
        "Teeth whitening session",
        "Cavity treatment",
      ]),
      createdAt: new Date(generateRandomTimestamp(createdAtStart, createdAtEnd)),
      updatedAt: new Date(generateRandomTimestamp(createdAtStart, createdAtEnd)),
    };

    // Track non-cancelled appointments in doctor schedule
    if (statusValue !== "cancelled" && statusValue !== "pending") {
      if (!doctorSchedule[doctor]) {
        doctorSchedule[doctor] = [];
      }
      doctorSchedule[doctor].push({
        date: dateStr,
        start: slotStart,
        end: slotEnd
      });
    }

    generatedAppointments.push(appointment);
  }

  return generatedAppointments;
}

function generateFinanceRecords(appointments: Appointment[]): Omit<FinanceRecord, "id" | "deleted" | "deletedAt">[] {
  const records: Omit<FinanceRecord, "id" | "deleted" | "deletedAt">[] = [];
  
  appointments.forEach(apt => {
    // Only create records for appointments with valid prices
    const price = apt.price || 0;
    if (price <= 0) return; // Skip if no price
    
    // For appointments with payments, use their createdAt/updatedAt
    // For appointments without payments, use their createdAt/updatedAt for charges
    const aptCreatedAt = apt.createdAt ? new Date(apt.createdAt) : new Date();
    const aptUpdatedAt = apt.updatedAt ? new Date(apt.updatedAt) : aptCreatedAt;
    
    // 1. Create a charge for the procedure
    const procedureName = getAppointmentTypeName(apt.type, apt.customType);
    records.push({
      patientId: apt.patientId,
      type: "charge",
      amount: price,
      date: apt.date,
      description: `${procedureName} charge`,
      createdAt: aptCreatedAt,
      updatedAt: aptUpdatedAt,
    });

    // 2. If any amount was paid, create a payment record at the SAME TIME as the appointment
    // (both happen when admin makes/updates the appointment with payment)
    if (apt.totalPaid && apt.totalPaid > 0) {
      records.push({
        patientId: apt.patientId,
        type: "payment",
        amount: apt.totalPaid,
        date: apt.date,
        description: `Payment for ${procedureName}`,
        createdAt: aptCreatedAt,
        updatedAt: aptUpdatedAt,
      });
    }
  });

  return records;
}

function generateNotifications(patients: Patient[], staff: Staff[], appointments: Appointment[]): Omit<Notification, "id">[] {
  const notifications: Omit<Notification, "id">[] = [];
  
  const adminUserId = "admin";
  
  // 1. APPOINTMENT NOTIFICATIONS
  const appointmentNotifications = appointments
    .filter(apt => ["scheduled", "completed"].includes(apt.status as string))
    .slice(0, Math.ceil(appointments.length * 0.4)); // ~40% of appointments
  
  appointmentNotifications.forEach(apt => {
    const serviceName = getAppointmentTypeName(apt.type, apt.customType);
    const isCompleted = apt.status === "completed";
    // Use appointment's updatedAt for notification timestamp (when it was last updated/recorded)
    // Ensure we have a valid timestamp - use updatedAt, then createdAt, then generate one
    let notificationCreatedAt: string;
    if (apt.updatedAt instanceof Date) {
      notificationCreatedAt = apt.updatedAt.toISOString();
    } else if (typeof apt.updatedAt === 'string') {
      notificationCreatedAt = apt.updatedAt;
    } else if (apt.createdAt instanceof Date) {
      notificationCreatedAt = apt.createdAt.toISOString();
    } else if (typeof apt.createdAt === 'string') {
      notificationCreatedAt = apt.createdAt;
    } else {
      // Fallback: generate a random timestamp from 6 months ago
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      notificationCreatedAt = generateRandomTimestamp(sixMonthsAgo, now);
    }
    
    // Patient notification
    if (apt.patientId) {
      notifications.push({
        userId: apt.patientId,
        title: isCompleted ? "Appointment Completed" : "Appointment Scheduled",
        message: isCompleted
          ? `Your ${serviceName} appointment with ${apt.doctor} on ${apt.date} at ${apt.time} has been completed.`
          : `Your ${serviceName} appointment with ${apt.doctor} on ${apt.date} at ${apt.time} has been confirmed.`,
        type: "appointment" as NotificationType,
        isRead: Math.random() > 0.5,
        createdAt: notificationCreatedAt,
        metadata: {
          appointmentId: apt.id,
          patientName: apt.patientName,
          appointmentDate: apt.date,
          appointmentTime: apt.time,
          doctor: apt.doctor
        }
      });
    }
    
    // Admin notification
    notifications.push({
      userId: adminUserId,
      title: isCompleted ? "Appointment Completed" : "Appointment Scheduled",
      message: isCompleted
        ? `${apt.patientName}'s ${serviceName} appointment with ${apt.doctor} on ${apt.date} at ${apt.time} is now completed.`
        : `${apt.patientName}'s ${serviceName} appointment with ${apt.doctor} on ${apt.date} at ${apt.time} has been scheduled.`,
      type: "appointment" as NotificationType,
      isRead: true,
      createdAt: notificationCreatedAt,
      metadata: {
        appointmentId: apt.id,
        patientName: apt.patientName,
        appointmentDate: apt.date,
        appointmentTime: apt.time,
        doctor: apt.doctor
      }
    });
  });

  // 2. PAYMENT NOTIFICATIONS
  // For every appointment that has a payment (totalPaid > 0), create payment notifications
  // Payment notifications happen at the SAME TIME as the appointment was made/updated with the payment
  const appointmentsWithPayments = appointments.filter(apt => apt.totalPaid && apt.totalPaid > 0);
  
  appointmentsWithPayments.forEach(apt => {
    const serviceName = getAppointmentTypeName(apt.type, apt.customType);
    const amountPaid = apt.totalPaid || 0;
    // Payment notification uses updatedAt (when payment was recorded with the appointment)
    // or createdAt if updatedAt doesn't exist
    let paymentNotificationCreatedAt: string;
    if (apt.updatedAt instanceof Date) {
      paymentNotificationCreatedAt = apt.updatedAt.toISOString();
    } else if (typeof apt.updatedAt === 'string') {
      paymentNotificationCreatedAt = apt.updatedAt;
    } else if (apt.createdAt instanceof Date) {
      paymentNotificationCreatedAt = apt.createdAt.toISOString();
    } else if (typeof apt.createdAt === 'string') {
      paymentNotificationCreatedAt = apt.createdAt;
    } else {
      // Fallback: generate a random timestamp from 6 months ago
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      paymentNotificationCreatedAt = generateRandomTimestamp(sixMonthsAgo, now);
    }
    
    // Patient notification (sees their own payment)
    if (apt.patientId) {
      notifications.push({
        userId: apt.patientId,
        title: "Payment Recorded",
        message: `A payment of ₱${amountPaid.toLocaleString()} has been recorded for your ${serviceName} appointment.`,
        type: "payment" as NotificationType,
        isRead: Math.random() > 0.7,
        createdAt: paymentNotificationCreatedAt,
        metadata: {
          appointmentId: apt.id,
          patientName: apt.patientName,
          amount: amountPaid,
          appointmentDate: apt.date,
          appointmentTime: apt.time
        }
      });
    }
    
    // Admin notification (sees clinic-wide payment)
    notifications.push({
      userId: adminUserId,
      title: "Payment Received",
      message: `A payment of ₱${amountPaid.toLocaleString()} has been received from ${apt.patientName} for their ${serviceName} appointment on ${apt.date}.`,
      type: "payment" as NotificationType,
      isRead: true,
      createdAt: paymentNotificationCreatedAt,
      metadata: {
        appointmentId: apt.id,
        patientName: apt.patientName,
        amount: amountPaid,
        appointmentDate: apt.date,
        appointmentTime: apt.time
      }
    });
  });

  return notifications;
}

async function seedDatabase() {
  try {
    // Perform admin login first
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
      console.error("❌ Seeding aborted: Admin login failed");
      return;
    }

    console.log("🌱 Generating seeder data...\n");

    // Generate patients
    const generatedPatientsData = generatePatients(25);
    console.log(`✅ Generated ${generatedPatientsData.length} patients data\n`);

    // --- Seed Patients ---
    const createdPatients: Patient[] = [];
    console.log("📤 Adding patients to database via API...");
    for (const patientData of generatedPatientsData) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/patients", {
          method: "POST",
          body: JSON.stringify(patientData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add patient ${patientData.firstName} ${patientData.lastName}`);
        } else {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.data) {
            createdPatients.push(apiResponse.data);
          } else {
            console.error(`❌ API failed to return patient data for ${patientData.firstName} ${patientData.lastName}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error adding patient: ${err}`);
      }
    }
    console.log(`✅ All primary patients added. Total: ${createdPatients.length}\n`);

    // --- Seed Dependents ---
    console.log("👪 Generating and seeding dependents...");
    const dependentsToCreate: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [];
    
    // Pick 40% of patients to have dependents
    const parents = createdPatients.filter(() => Math.random() > 0.6);
    // Always give test patient some dependents
    const testPatient = createdPatients.find(p => p.email === "test@patient.com");
    if (testPatient && !parents.includes(testPatient)) {
      parents.push(testPatient);
    }

    for (const parent of parents) {
      const isTestPatient = parent.email === "test@patient.com";
      const familyCount = isTestPatient ? 3 : getRandomInt(1, 3);
      const parentDependents = generateDependents(parent, familyCount);
      dependentsToCreate.push(...parentDependents);
    }

    console.log(`📤 Adding ${dependentsToCreate.length} dependents to database via API...`);
    for (const dependentData of dependentsToCreate) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/patients", {
          method: "POST",
          body: JSON.stringify(dependentData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add dependent ${dependentData.firstName} ${dependentData.lastName}`);
        } else {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.data) {
            createdPatients.push(apiResponse.data);
          }
        }
      } catch (err) {
        console.error(`❌ Error adding dependent: ${err}`);
      }
    }
    console.log(`✅ All dependents added. Total patients now: ${createdPatients.length}\n`);

    // --- Seed Staff Members ---
    const createdStaff: Staff[] = [];
    console.log("📤 Adding staff members to database via API...");
    for (const staffData of staffMembersData) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/staff", {
          method: "POST",
          body: JSON.stringify(staffData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add staff member: ${staffData.name}`);
        } else {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.data) {
            createdStaff.push(apiResponse.data);
          }
        }
      } catch (err) {
        console.error(`❌ Error adding staff member: ${err}`);
      }
    }
    console.log(`✅ All staff members added. Total: ${createdStaff.length}\n`);

    // Generate appointments
    const generatedAppointmentsData = generateAppointments(createdPatients, doctorNames, 60);
    console.log(`✅ Generated ${generatedAppointmentsData.length} appointments data\n`);

    // --- Seed Appointments ---
    const createdAppointments: Appointment[] = [];
    console.log("📤 Adding appointments to database via API...");
    for (const appointmentData of generatedAppointmentsData) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/appointments", {
          method: "POST",
          headers: {
            "x-seeding-key": "seeding-mode",
          },
          body: JSON.stringify({ ...appointmentData, isSeeding: true }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to add appointment for patientId ${appointmentData.patientId}. Status: ${response.status}. Error: ${errorText}`);
        } else {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.data) {
            createdAppointments.push(apiResponse.data);
          } else {
            console.error(`❌ API returned unsuccessful response for patientId ${appointmentData.patientId}: ${apiResponse.message || 'Unknown error'}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error adding appointment: ${err}`);
      }
    }
    console.log(`✅ All appointments added. Total: ${createdAppointments.length}\n`);

    // Generate finance records
    const generatedFinanceRecords = generateFinanceRecords(createdAppointments);
    console.log(`✅ Generated ${generatedFinanceRecords.length} finance records data\n`);

    // --- Seed Finance Records ---
    console.log("📤 Adding finance records to database via API...");
    for (const record of generatedFinanceRecords) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/finance", {
          method: "POST",
          body: JSON.stringify({ ...record, isSeeding: true }),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add finance record for patientId ${record.patientId}`);
        }
      } catch (err) {
        console.error(`❌ Error adding finance record: ${err}`);
      }
    }
    console.log(`✅ All finance records added. Total: ${generatedFinanceRecords.length}\n`);

    // --- Seed Inventory Items ---
    console.log("📤 Adding inventory items to database via API...");
    for (const itemData of inventoryItemsData) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/inventory", {
          method: "POST",
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add inventory item: ${itemData.item}`);
        }
      } catch (err) {
        console.error(`❌ Error adding inventory item: ${err}`);
      }
    }
    console.log(`✅ All inventory items added. Total: ${inventoryItemsData.length}\n`);

    // --- Seed Payment Methods ---
    console.log("📤 Adding payment methods to database via API...");
    for (const paymentMethodData of paymentMethodsData) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/payment-methods", {
          method: "POST",
          body: JSON.stringify(paymentMethodData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add payment method: ${paymentMethodData.name}`);
        }
      } catch (err) {
        console.error(`❌ Error adding payment method: ${err}`);
      }
    }
    console.log(`✅ All payment methods added. Total: ${paymentMethodsData.length}\n`);

    // --- Seed Notifications ---
    console.log("🔔 Generating and seeding notifications...");
    const notificationsToCreate = generateNotifications(createdPatients, createdStaff, createdAppointments);
    console.log(`📤 Adding ${notificationsToCreate.length} notifications to database via API...`);
    for (const notificationData of notificationsToCreate) {
      try {
        const response = await fetchWithAuth("http://localhost:3001/api/notifications", {
          method: "POST",
          headers: {
            "x-seeding-key": "seeding-mode",
          },
          body: JSON.stringify({ ...notificationData, isSeeding: true }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to add notification for userId ${notificationData.userId}. Status: ${response.status}. Error: ${errorText}`);
        }
      } catch (err) {
        console.error(`❌ Error adding notification: ${err}`);
      }
    }
    console.log(`✅ All notifications added. Total: ${notificationsToCreate.length}\n`);

    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Total Patients Added: ${createdPatients.length}`);
    console.log(`   ✅ Total Appointments Added: ${createdAppointments.length}`);
    console.log(`   ✅ Total Finance Records Added: ${generatedFinanceRecords.length}`);
    console.log(`   ✅ Total Inventory Items Added: ${inventoryItemsData.length}`);
    console.log(`   ✅ Total Payment Methods Added: ${paymentMethodsData.length}`);
    console.log(`   ✅ Total Staff Members Added: ${createdStaff.length}`);
    console.log(`   ✅ Total Notifications Added: ${notificationsToCreate.length}`);
    console.log("\n✨ Database seeding completed successfully!");
    console.log("🎉 You can now refresh your application to see the new data.\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    if (response.ok) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log("\n🚀 Villahermosa Dental Clinic - Database Seeder");
  console.log("=".repeat(50) + "\n");

  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    console.error("❌ Error: Server is not running!");
    console.log("   Please start the server with: npm run start");
    console.log("   Or in development mode with: npm run dev\n");
    process.exit(1);
  }

  console.log("✅ Server is running\n");
  await seedDatabase();
}

main();
