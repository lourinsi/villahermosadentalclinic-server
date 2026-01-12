#!/usr/bin/env ts-node
// Seeder script to populate the database with random dummy data
// Run with: npm run seed

import { Patient } from "./types/patient";
import { Appointment } from "./types/appointment";
import { Staff } from "./types/staff";
import { InventoryItem } from "./types/inventory";
import { FinanceRecord } from "./types/finance";


// Sample data for seeding
const firstNames = [
  "John",
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


const APPOINTMENT_TYPES = [
  "Routine Cleaning",
  "Checkup",
  "Filling",
  "Root Canal",
  "Extraction",
  "Whitening",
  "Other",
];

const statuses = ["active", "inactive", "overdue"];

const insurances = ["Blue Cross", "Aetna", "Delta Dental", "Cigna", "United Healthcare", "None"];

const staffRoles = ["Lead Dentist", "Associate Dentist", "Pediatric Dentist", "Dental Hygienist", "Dental Assistant", "Office Manager", "Receptionist"];
const departments = ["Dentistry", "Hygiene", "Assistance", "Administration"];
const employmentTypes = ["Full-time", "Part-time", "Contract"];
const specializations = ["General Dentistry", "Orthodontics", "Pediatric Dentistry", "Dental Hygiene", "Chair-side Assistance", "Office Management", "Patient Relations"];

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
    licenseNumber: "DDS-12345"
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
    licenseNumber: "DDS-23456"
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
    licenseNumber: "DDS-34567"
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
    licenseNumber: "RDH-45678"
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
    licenseNumber: "DA-56789"
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
    licenseNumber: "N/A"
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
    licenseNumber: "N/A"
  }
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
    let lastDate = patientLastVisit ? new Date(patientLastVisit) : new Date();
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

  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`;
    const phone = `(${getRandomInt(200, 999)}) ${getRandomInt(200, 999)}-${getRandomInt(1000, 9999)}`;
    const dateOfBirth = new Date(getRandomInt(1960, 2005), getRandomInt(0, 11), getRandomInt(1, 28));

    const hasLastVisit = Math.random() > 0.2;
    const randomVisitDate = getRandomDate(oneYearAgo, now);
    const lastVisitDate = hasLastVisit ? `${randomVisitDate.getFullYear()}-${(randomVisitDate.getMonth() + 1).toString().padStart(2, '0')}-${randomVisitDate.getDate().toString().padStart(2, '0')}` : undefined;
    
    const dentalCharts = generateDentalCharts(lastVisitDate);

    const patient: Omit<Patient, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: dateOfBirth.toISOString().split("T")[0],
      address: `${getRandomInt(100, 9999)} ${getRandomElement(["Main", "Oak", "Elm", "Maple", "Pine", "Cedar"])} St, ${getRandomElement(["Springfield", "Shelbyville", "Capital City", "Metropolis", "Gotham"])}`,
      city: getRandomElement(["Springfield", "Shelbyville", "Capital City", "Metropolis", "Gotham"]),
      zipCode: `${getRandomInt(10000, 99999)}`,
      insurance: getRandomElement(insurances),
      status: getRandomElement(statuses),
      emergencyContact: getRandomElement(firstNames) + " " + getRandomElement(lastNames),
      emergencyPhone: `(${getRandomInt(200, 999)}) ${getRandomInt(200, 999)}-${getRandomInt(1000, 9999)}`,
      allergies: Math.random() > 0.7 ? getRandomElement(["Penicillin", "Latex", "Iodine", "None"]) : "None",
      medicalHistory: getRandomElement(["Diabetes", "Hypertension", "Asthma", "None"]),
      notes: getRandomElement(["VIP patient", "Referred by friend", "Online inquiry", ""]),
      dentalCharts: dentalCharts,
      lastVisit: lastVisitDate,
    };

    generatedPatients.push(patient);
  }

  return generatedPatients;
}

function generateAppointments(patientsList: Patient[], doctorsList: string[], count: number = 60): Omit<Appointment, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] {
  const generatedAppointments: Omit<Appointment, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [];
  const now = new Date();
  const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  // First, create a completed appointment for each patient's lastVisit if they have one
  patientsList.forEach(patient => {
    if (patient.lastVisit) {
      generatedAppointments.push({
        patientId: patient.id || "",
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: patient.lastVisit,
        time: `${String(getRandomInt(8, 17)).padStart(2, "0")}:${String(getRandomElement([0, 30])).padStart(2, "0")}`,
        type: getRandomInt(0, APPOINTMENT_TYPES.length - 2), // Avoid 'Other' for past, completed appointments
        doctor: doctorsList.length > 0 ? getRandomElement(doctorsList) : "",
        price: parseFloat(getRandomInt(50, 500).toFixed(2)),
        status: "completed",
        notes: "Routine visit completed.",
      });
    }
  });

  // Then generate some random future/mixed appointments
  const remainingCount = Math.max(0, count - generatedAppointments.length);
  for (let i = 0; i < remainingCount; i++) {
    const patient = getRandomElement(patientsList);
    // 20% chance of an additional past appointment
    const isPast = Math.random() > 0.8;
    const appointmentDate = isPast ? getRandomDate(oneYearAgo, now) : getRandomDate(now, sixMonthsLater);
    const hour = getRandomInt(8, 17);
    const minute = getRandomElement([0, 30]);
    const appointmentTypeIndex = getRandomInt(0, APPOINTMENT_TYPES.length - 1);
    const customType = appointmentTypeIndex === APPOINTMENT_TYPES.length - 1 ? "Custom user-defined procedure" : undefined;

    const appointment: Omit<Appointment, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
      patientId: patient.id || "",
      patientName: `${patient.firstName} ${patient.lastName}`,
      date: `${appointmentDate.getFullYear()}-${(appointmentDate.getMonth() + 1).toString().padStart(2, '0')}-${appointmentDate.getDate().toString().padStart(2, '0')}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      type: appointmentTypeIndex,
      customType: customType,
      doctor: doctorsList.length > 0 ? getRandomElement(doctorsList) : "",
      price: parseFloat(getRandomInt(50, 500).toFixed(2)),
      status: isPast ? "completed" : getRandomElement(["pending", "confirmed", "scheduled"]),
      notes: getRandomElement([
        "Routine cleaning and checkup",
        "Follow-up from previous visit",
        "New patient evaluation",
        "Emergency appointment",
        "Crown placement",
      ]),
    };

    generatedAppointments.push(appointment);
  }

  return generatedAppointments;
}

function generateFinanceRecords(patientsList: Patient[], count: number = 80): Omit<FinanceRecord, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] {
  const records: Omit<FinanceRecord, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt">[] = [];
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (let i = 0; i < count; i++) {
    const patient = getRandomElement(patientsList);
    const date = getRandomDate(twoYearsAgo, now);
    const isPayment = Math.random() > 0.4; // ~60% charges, 40% payments
    const amount = parseFloat((Math.random() * (isPayment ? 200 : 800) + 20).toFixed(2));
    const record: Omit<FinanceRecord, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
      patientId: patient.id || "",
      type: isPayment ? "payment" : "charge",
      amount: amount,
      date: date.toISOString().split("T")[0],
      description: isPayment ? "Payment received" : getRandomElement(["Procedure charge", "Treatment fee", "Supply charge"]),
    };

    records.push(record);
  }

  return records;
}

async function seedDatabase() {
  try {
    console.log("\n🌱 Generating seeder data...\n");

    // Generate patients
    const generatedPatientsData = generatePatients(25);
    console.log(`✅ Generated ${generatedPatientsData.length} patients data\n`);

    // --- Seed Patients ---
    const createdPatients: Patient[] = [];
    console.log("📤 Adding patients to database via API...");
    for (const patientData of generatedPatientsData) {
      try {
        const response = await fetch("http://localhost:3001/api/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
    console.log(`✅ All patients added. Total: ${createdPatients.length}\n`);

    // Generate appointments
    const generatedAppointmentsData = generateAppointments(createdPatients, doctorNames, 60);
    console.log(`✅ Generated ${generatedAppointmentsData.length} appointments data\n`);

    // --- Seed Appointments ---
    console.log("📤 Adding appointments to database via API...");
    for (const appointmentData of generatedAppointmentsData) {
      try {
        const response = await fetch("http://localhost:3001/api/appointments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(appointmentData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add appointment for patientId ${appointmentData.patientId}`);
        }
      } catch (err) {
        console.error(`❌ Error adding appointment: ${err}`);
      }
    }
    console.log(`✅ All appointments added. Total: ${generatedAppointmentsData.length}\n`);

    // Generate finance records
    const generatedFinanceRecords = generateFinanceRecords(createdPatients, 80);
    console.log(`✅ Generated ${generatedFinanceRecords.length} finance records data\n`);

    // --- Seed Finance Records ---
    console.log("📤 Adding finance records to database via API...");
    for (const record of generatedFinanceRecords) {
      try {
        const response = await fetch("http://localhost:3001/api/finance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(record),
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
        const response = await fetch("http://localhost:3001/api/inventory", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

    // --- Seed Staff Members ---
    console.log("📤 Adding staff members to database via API...");
    for (const staffData of staffMembersData) {
      try {
        const response = await fetch("http://localhost:3001/api/staff", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(staffData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add staff member: ${staffData.name}`);
        }
      } catch (err) {
        console.error(`❌ Error adding staff member: ${err}`);
      }
    }
    console.log(`✅ All staff members added. Total: ${staffMembersData.length}\n`);

    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Total Patients Added: ${createdPatients.length}`);
    console.log(`   ✅ Total Appointments Added: ${generatedAppointmentsData.length}`);
    console.log(`   ✅ Total Finance Records Added: ${generatedFinanceRecords.length}`);
    console.log(`   ✅ Total Inventory Items Added: ${inventoryItemsData.length}`);
    console.log(`   ✅ Total Staff Members Added: ${staffMembersData.length}`);
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