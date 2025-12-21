#!/usr/bin/env ts-node
// Seeder script to populate the database with random dummy data
// Run with: npm run seed

// First, we need to import and manipulate the controllers' in-memory storage
// Since the storage is internal, we'll create a separate in-memory storage and log it
// Then the user can manually add this data or we can create an API endpoint

import { Patient } from "./types/patient";
import { Appointment } from "./types/appointment";

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

const doctors = ["Dr. Johnson", "Dr. Chen", "Dr. Rodriguez", "Dr. Williams", "Dr. Lee"];

const appointmentTypes = ["Cleaning", "Checkup", "Filling", "Root Canal", "Extraction", "Whitening"];

const statuses = ["active", "inactive", "overdue"];

const insurances = ["Blue Cross", "Aetna", "Delta Dental", "Cigna", "United Healthcare", "None"];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(startDate: Date, endDate: Date): Date {
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
}

function generatePatients(count: number = 25): Patient[] {
  const generatedPatients: Patient[] = [];
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`;
    const phone = `(${getRandomInt(200, 999)}) ${getRandomInt(200, 999)}-${getRandomInt(1000, 9999)}`;
    const dateOfBirth = new Date(getRandomInt(1960, 2005), getRandomInt(0, 11), getRandomInt(1, 28));

    const patient: Patient = {
      id: `patient_${Date.now() + i}`,
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
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    generatedPatients.push(patient);
  }

  return generatedPatients;
}

function generateAppointments(patientsList: Patient[], count: number = 60): Appointment[] {
  const generatedAppointments: Appointment[] = [];
  const now = new Date();
  const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());

  for (let i = 0; i < count; i++) {
    const patient = getRandomElement(patientsList);
    const appointmentDate = getRandomDate(now, sixMonthsLater);
    const hour = getRandomInt(8, 17);
    const minute = getRandomElement([0, 15, 30, 45]);

    const appointment: Appointment = {
      id: `appointment_${Date.now() + i}`,
      patientId: patient.id || "",
      patientName: `${patient.firstName} ${patient.lastName}`,
      date: appointmentDate.toISOString().split("T")[0],
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      type: getRandomElement(appointmentTypes),
      doctor: getRandomElement(doctors),
      status: getRandomElement(["pending", "confirmed", "completed"]),
      notes: getRandomElement([
        "Routine cleaning and checkup",
        "Follow-up from previous visit",
        "New patient evaluation",
        "Emergency appointment",
        "Crown placement",
      ]),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    generatedAppointments.push(appointment);
  }

  return generatedAppointments;
}

function generateFinanceRecords(patientsList: Patient[], count: number = 80) {
  const records: any[] = [];
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (let i = 0; i < count; i++) {
    const patient = getRandomElement(patientsList);
    const date = getRandomDate(twoYearsAgo, now);
    const isPayment = Math.random() > 0.4; // ~60% charges, 40% payments
    const amount = parseFloat((Math.random() * (isPayment ? 200 : 800) + 20).toFixed(2));
    const record = {
      id: `finance_${Date.now()}_${i}`,
      patientId: patient.id || "",
      type: isPayment ? "payment" : "charge",
      amount: amount,
      date: date.toISOString().split("T")[0],
      description: isPayment ? "Payment received" : getRandomElement(["Procedure charge", "Treatment fee", "Supply charge"]),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    records.push(record);
  }

  return records;
}

async function seedDatabase() {
  try {
    console.log("\n🌱 Generating seeder data...\n");

    // Generate patients
    const generatedPatients = generatePatients(25);
    console.log(`✅ Generated ${generatedPatients.length} patients\n`);

    // Generate appointments
    const generatedAppointments = generateAppointments(generatedPatients, 60);
    console.log(`✅ Generated ${generatedAppointments.length} appointments\n`);

    // Now add patients via API
    console.log("📤 Adding patients to database via API...");
    for (const patient of generatedPatients) {
      try {
        const response = await fetch("http://localhost:3001/api/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patient),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add patient ${patient.firstName} ${patient.lastName}`);
        }
      } catch (err) {
        console.error(`❌ Error adding patient: ${err}`);
      }
    }
    console.log("✅ All patients added\n");

    // Add appointments via API
    console.log("📤 Adding appointments to database via API...");
    for (const appointment of generatedAppointments) {
      try {
        const response = await fetch("http://localhost:3001/api/appointments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(appointment),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add appointment for ${appointment.patientName}`);
        }
      } catch (err) {
        console.error(`❌ Error adding appointment: ${err}`);
      }
    }
    console.log("✅ All appointments added\n");

    // Generate finance records and POST to backend
    console.log("📤 Generating and adding finance records via API...");
    const generatedFinance = generateFinanceRecords(generatedPatients, 80);
    for (const record of generatedFinance) {
      try {
        const response = await fetch("http://localhost:3001/api/finance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(record),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add finance record for ${record.patientId}`);
        }
      } catch (err) {
        console.error(`❌ Error adding finance record: ${err}`);
      }
    }
    console.log(`✅ All finance records added (${generatedFinance.length})\n`);

    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Total Patients Added: ${generatedPatients.length}`);
    console.log(`   ✅ Total Appointments Added: ${generatedAppointments.length}`);
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

