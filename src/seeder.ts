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
import { Notification, NotificationType } from "./types/notification";


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
    profilePicture: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=200&h=200&auto=format&fit=crop",
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
    profilePicture: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&h=200&auto=format&fit=crop",
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
    profilePicture: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&h=200&auto=format&fit=crop",
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
    profilePicture: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=200&h=200&auto=format&fit=crop",
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
    password: bcrypt.hashSync("doctor123", 10)
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
    password: bcrypt.hashSync("doctor123", 10)
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
    password: bcrypt.hashSync("doctor123", 10)
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
    password: bcrypt.hashSync("doctor123", 10)
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
  };
  generatedPatients.push(testPatient);


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

    dependents.push({
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: parent.email, // Inherited
      phone: parent.phone, // Inherited
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
      medicalHistory: "None",
      notes: `Dependent of ${parent.name}`,
      dentalCharts: dentalCharts,
      lastVisit: lastVisitDate,
    });
  }
  return dependents;
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
        price: [1500, 500, 1200, 5000, 1500, 3000][getRandomInt(0, 5)],
        status: "completed",
        paymentStatus: "paid",
        balance: 0,
        totalPaid: 1, // Will be set correctly by backend or placeholder
        notes: "Routine visit completed.",
      });
    }
  });

  // Add specific appointments for test patient
  const testPatient = patientsList.find(p => p.email === "test@patient.com");
  const testDoctorName = "Dr. Test Doctor";
  
  if (testPatient) {
    // 2 in Cart (pending, unpaid)
    for (let i = 0; i < 2; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() + getRandomInt(1, 14));
        generatedAppointments.push({
            patientId: testPatient.id || "",
            patientName: testPatient.name,
            date: date.toISOString().split("T")[0],
            time: "09:00",
            type: getRandomInt(0, 5),
            doctor: testDoctorName, // Assign to test doctor
            price: 1500,
            status: "pending",
            paymentStatus: "unpaid",
            balance: 1500,
            totalPaid: 0,
            notes: "Pending in cart."
        });
    }
    // 1 Tentative (half-paid)
    generatedAppointments.push({
        patientId: testPatient.id || "",
        patientName: testPatient.name,
        date: new Date(now.getTime() + 86400000 * 3).toISOString().split("T")[0],
        time: "11:00",
        type: 0,
        doctor: testDoctorName, // Assign to test doctor
        price: 1500,
        status: "tentative",
        paymentStatus: "half-paid",
        balance: 1000,
        totalPaid: 500,
        notes: "Tentative booking with partial payment."
    });
    // 1 To Pay (Clinic payment, scheduled)
    generatedAppointments.push({
        patientId: testPatient.id || "",
        patientName: testPatient.name,
        date: new Date(now.getTime() + 86400000 * 4).toISOString().split("T")[0],
        time: "13:30",
        type: 3,
        doctor: testDoctorName, // Assign to test doctor
        price: 5000,
        status: "To Pay",
        paymentStatus: "unpaid",
        balance: 5000,
        totalPaid: 0,
        notes: "Pay at clinic request."
    });
    // 2 in Bookings (confirmed/scheduled, paid)
    generatedAppointments.push({
        patientId: testPatient.id || "",
        patientName: testPatient.name,
        date: new Date(now.getTime() + 86400000 * 2).toISOString().split("T")[0],
        time: "10:30",
        type: 1,
        doctor: testDoctorName, // Assign to test doctor
        price: 500,
        status: "confirmed",
        paymentStatus: "paid",
        balance: 0,
        totalPaid: 500,
        notes: "Confirmed and paid."
    });
    generatedAppointments.push({
        patientId: testPatient.id || "",
        patientName: testPatient.name,
        date: new Date(now.getTime() + 86400000 * 5).toISOString().split("T")[0],
        time: "14:00",
        type: 2,
        doctor: testDoctorName, // Assign to test doctor
        price: 1200,
        status: "scheduled",
        paymentStatus: "paid",
        balance: 0,
        totalPaid: 1200,
        notes: "Scheduled and fully paid."
    });
  }

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
    
    const status = (isPast ? "completed" : getRandomElement(["pending", "tentative", "To Pay", "confirmed", "scheduled"])) as any;
    
    let paymentStatus: "paid" | "unpaid" | "half-paid" = "unpaid";
    if (status === "completed") paymentStatus = "paid";
    else if (status === "pending") paymentStatus = "unpaid";
    else if (status === "tentative") paymentStatus = "half-paid";
    else if (status === "To Pay") paymentStatus = "unpaid";
    else paymentStatus = Math.random() > 0.3 ? "paid" : "unpaid";

    const price = [1500, 500, 1200, 5000, 1500, 3000][getRandomInt(0, 5)] || 1000;
    let totalPaid = 0;
    if (paymentStatus === "paid") totalPaid = price;
    else if (paymentStatus === "half-paid") totalPaid = Math.floor(price / 2);
    
    const balance = price - totalPaid;

    const appointment: Omit<Appointment, "id" | "createdAt" | "updatedAt" | "deleted" | "deletedAt"> = {
      patientId: patient.id || "",
      patientName: `${patient.firstName} ${patient.lastName}`,
      date: `${appointmentDate.getFullYear()}-${(appointmentDate.getMonth() + 1).toString().padStart(2, '0')}-${appointmentDate.getDate().toString().padStart(2, '0')}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      type: appointmentTypeIndex,
      customType: customType,
      doctor: doctorsList.length > 0 ? getRandomElement(doctorsList) : "",
      price: price,
      status: status,
      paymentStatus: paymentStatus,
      totalPaid: totalPaid,
      balance: balance,
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

function generateNotifications(patients: Patient[], staff: Staff[], appointments: Appointment[]): any[] {
  const notifications: any[] = [];
  
  const admin = staff.find(s => s.role.toLowerCase().includes("manager")) || staff[0];
  const doctors = staff.filter(s => s.role.toLowerCase().includes("dentist"));
  
  // 1. Admin notifications
  if (admin) {
    // New patient registrations
    patients.slice(0, 5).forEach(p => {
      notifications.push({
        userId: admin.id || "",
        title: "New Patient Registration",
        message: `A new patient, ${p.firstName} ${p.lastName}, has registered on the portal.`,
        type: "system",
        isRead: Math.random() > 0.5,
        createdAt: new Date().toISOString(),
      });
    });
    
    // Cancellation requests
    appointments.filter(a => a.status === "pending").slice(0, 3).forEach(a => {
      notifications.push({
        userId: admin.id || "",
        title: "Appointment Request",
        message: `${a.patientName} has requested an appointment for ${APPOINTMENT_TYPES[a.type || 0]} on ${a.date}.`,
        type: "appointment",
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
          appointmentId: a.id,
          currentStatus: a.status,
          patientName: a.patientName,
          isRequest: ["pending", "tentative", "To Pay"].includes(a.status || '')
        }
      });
    });
    
    // Payment alerts
    notifications.push({
      userId: admin.id || "",
      title: "Payment Reconciliation",
      message: "Multiple payments are pending reconciliation for the current month.",
      type: "payment",
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    
    // Add a low stock alert
    notifications.push({
      userId: admin.id || "",
      title: "Low Stock Alert",
      message: 'Item "Dental Anesthetic (Lidocaine)" is low on stock (45 vials remaining).',
      type: "system",
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  // 2. Doctor notifications
  doctors.forEach(doc => {
    const docAppointments = appointments.filter(a => a.doctor === doc.name);
    
    // New Appointment Requests (pending, tentative, To Pay)
    const requests = docAppointments.filter(a => ["pending", "tentative", "To Pay"].includes(a.status || ''));
    requests.forEach(a => {
      notifications.push({
        userId: doc.id || "",
        title: "New Appointment Request",
        message: `${a.patientName} has a ${a.status} appointment for ${APPOINTMENT_TYPES[a.type || 0]} on ${a.date} at ${a.time}.`,
        type: "appointment",
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
          appointmentId: a.id,
          currentStatus: a.status,
          patientName: a.patientName,
          isRequest: true
        }
      });
    });

    // Upcoming appointments (confirmed, scheduled)
    const upcoming = docAppointments.filter(a => ["confirmed", "scheduled"].includes(a.status || ''));
    upcoming.slice(0, 5).forEach(a => {
      notifications.push({
        userId: doc.id || "",
        title: "Upcoming Appointment",
        message: `You have an appointment with ${a.patientName} for ${APPOINTMENT_TYPES[a.type || 0]} today at ${a.time}.`,
        type: "appointment",
        isRead: Math.random() > 0.3,
        createdAt: new Date().toISOString(),
        metadata: {
          appointmentId: a.id,
          currentStatus: a.status,
          patientName: a.patientName,
          isRequest: false
        }
      });
    });
  });
  
  // 3. Patient notifications
  const testPatient = patients.find(p => p.email === "test@patient.com");
  const notificationPatients = patients.slice(0, 10);
  if (testPatient && !notificationPatients.includes(testPatient)) {
    notificationPatients.push(testPatient);
  }

  notificationPatients.forEach(p => {
    const pAppointments = appointments.filter(a => a.patientId === p.id);
    
    pAppointments.forEach(a => {
      const isRequest = ["pending", "tentative", "To Pay"].includes(a.status || '');
      notifications.push({
        userId: p.id || "",
        title: isRequest ? "Appointment Request Received" : "Appointment Confirmation",
        message: isRequest 
          ? `Your request for ${APPOINTMENT_TYPES[a.type || 0]} on ${a.date} at ${a.time} is ${a.status}.`
          : `Your appointment for ${APPOINTMENT_TYPES[a.type || 0]} on ${a.date} at ${a.time} has been ${a.status}.`,
        type: "appointment",
        isRead: Math.random() > 0.5,
        createdAt: new Date().toISOString(),
        metadata: {
          appointmentId: a.id,
          currentStatus: a.status,
          isRequest: isRequest
        }
      });
    });
    
    notifications.push({
      userId: p.id || "",
      title: "Welcome to Villahermosa Dental Clinic",
      message: "Thank you for joining our clinic. We look forward to serving you!",
      type: "system",
      isRead: true,
      createdAt: new Date().toISOString(),
    });
  });
  
  return notifications;
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
        const response = await fetch("http://localhost:3001/api/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        const response = await fetch("http://localhost:3001/api/staff", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        const response = await fetch("http://localhost:3001/api/appointments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(appointmentData),
        });

        if (!response.ok) {
          console.error(`❌ Failed to add appointment for patientId ${appointmentData.patientId}`);
        } else {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.data) {
            createdAppointments.push(apiResponse.data);
          }
        }
      } catch (err) {
        console.error(`❌ Error adding appointment: ${err}`);
      }
    }
    console.log(`✅ All appointments added. Total: ${createdAppointments.length}\n`);

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

    // --- Seed Payment Methods ---
    console.log("📤 Adding payment methods to database via API...");
    for (const paymentMethodData of paymentMethodsData) {
      try {
        const response = await fetch("http://localhost:3001/api/payment-methods", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        const response = await fetch("http://localhost:3001/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(notificationData),
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
