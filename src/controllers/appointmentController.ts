import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Appointment, ApiResponse } from "../types/appointment";
import { APPOINTMENT_TYPES, getAppointmentTypeName, getAppointmentPrice } from "../utils/appointment-types";
import { readData, writeData } from "../utils/storage";
import { hasConflict } from "../utils/appointment-helpers";
import { FinanceRecord } from "../types/finance";
import { Patient } from "../types/patient";
import { createNotification, notifyAdmin } from "../utils/notifications";

const COLLECTION = "appointments";

export const addAppointment = (req: Request, res: Response<ApiResponse<Appointment>>) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    console.log("[APPOINTMENT CREATE] Received request body:", req.body);
    const appointmentData: Appointment = req.body;

    // Basic validation
    if (
      !appointmentData.patientId || 
      !appointmentData.patientName || 
      !appointmentData.date || 
      !appointmentData.time ||
      appointmentData.type == null || // check for null/undefined
      appointmentData.type < 0
    ) {
      console.error("[APPOINTMENT CREATE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: patientId, patientName, date, time, type",
      });
    }

    // Check for conflicts
    if (hasConflict(
      appointments, 
      appointmentData.date, 
      appointmentData.time, 
      appointmentData.duration || 60, 
      appointmentData.doctor || ""
    )) {
      return res.status(409).json({
        success: false,
        message: "Conflict detected: There is already an appointment scheduled during this time.",
      });
    }

    if (appointmentData.type === APPOINTMENT_TYPES.length - 1 && !appointmentData.customType) {
      return res.status(400).json({
        success: false,
        message: "Custom type description is required when 'Other' is selected.",
      });
    }


    console.log("[APPOINTMENT CREATE] Creating appointment for patient:", appointmentData.patientName);

    const basePrice = getAppointmentPrice(appointmentData.type);

    // Create appointment object with ID and timestamps
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: appointmentData.patientId,
      patientName: appointmentData.patientName,
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type,
      customType: appointmentData.customType || "",
      price: appointmentData.price || basePrice,
      doctor: appointmentData.doctor || "",
      duration: appointmentData.duration || 60, // default to 60 minutes
      notes: appointmentData.notes || "",
      status: appointmentData.status || "scheduled",
      paymentStatus: appointmentData.paymentStatus || "unpaid",
      balance: appointmentData.balance != null ? appointmentData.balance : (appointmentData.price || basePrice),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    console.log("[APPOINTMENT CREATE] New appointment object created:", newAppointment);
    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);
    console.log("[APPOINTMENT CREATE] Appointment saved. Total appointments:", appointments.length);

    // Notify Patient
    createNotification(
      newAppointment.patientId,
      "Appointment Scheduled",
      `Your appointment for ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} is scheduled for ${newAppointment.date} at ${newAppointment.time}.`,
      "appointment",
      {
        appointmentId: newAppointment.id,
        currentStatus: newAppointment.status,
      }
    );

    // Notify Admin & Doctor
    const isRequest = ["pending", "tentative", "To Pay"].includes(newAppointment.status as string);
    
    if (newAppointment.paymentStatus !== "unpaid" || isRequest) {
      notifyAdmin(
        isRequest ? "New Appointment Request" : "New Appointment Scheduled",
        `${newAppointment.patientName} has a ${newAppointment.status} appointment for ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} on ${newAppointment.date} at ${newAppointment.time}.`,
        "appointment",
        {
          appointmentId: newAppointment.id,
          currentStatus: newAppointment.status,
          patientName: newAppointment.patientName,
          isRequest: isRequest
        }
      );

      // Also notify the doctor specifically
      if (newAppointment.doctor) {
        const staff = readData<any>("staff");
        const doctor = staff.find((s: any) => s.name === newAppointment.doctor);
        if (doctor) {
          createNotification(
            doctor.id,
            isRequest ? "New Appointment Request" : "New Appointment Scheduled",
            `${newAppointment.patientName} has a ${newAppointment.status} appointment for ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} on ${newAppointment.date} at ${newAppointment.time}.`,
            "appointment",
            {
              appointmentId: newAppointment.id,
              currentStatus: newAppointment.status,
              patientName: newAppointment.patientName,
              isRequest: isRequest
            }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Appointment added successfully",
      data: newAppointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointments = (
  req: Request,
  res: Response<ApiResponse<Appointment[]>>
) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    const { startDate, endDate, search, doctor, type, status, patientId, parentId, anonymize, includeUnpaid } = req.query as Record<string, string>;
    
    // return only non-deleted appointments
    let filtered = appointments.filter(a => !a.deleted);

    // Filter for Cart (pending) vs Bookings (non-pending)
    // Only exclude pending if not specifically requested and not in includeUnpaid mode
    if (includeUnpaid !== 'true' && status !== 'pending') {
      filtered = filtered.filter(a => a.status !== 'pending');
    }

    const isGlobal = anonymize === 'true';

    // If parentId is provided, get all patients for that parent first
    if (parentId && !isGlobal) {
      const patients = readData<Patient>("patients");
      const familyIds = patients
        .filter(p => (p.parentId === parentId || p.id === parentId) && !p.deleted)
        .map(p => p.id);
      
      filtered = filtered.filter(a => familyIds.includes(a.patientId));
    } else if (patientId && !isGlobal) {
      filtered = filtered.filter(a => a.patientId === patientId);
    }

    // If search term is provided, prioritize searching (global search)
    if (search && search.trim() !== "") {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(a => 
        a.patientName.toLowerCase().includes(q) ||
        getAppointmentTypeName(a.type, a.customType).toLowerCase().includes(q) ||
        a.doctor.toLowerCase().includes(q)
      );
    } else {
      // Otherwise filter by date range if provided
      if (startDate && startDate !== "") {
        filtered = filtered.filter(a => (includeUnpaid === 'true' && (a.paymentStatus === 'unpaid' || a.status === 'pending')) || a.date >= startDate);
      }
      if (endDate && endDate !== "") {
        filtered = filtered.filter(a => (includeUnpaid === 'true' && (a.paymentStatus === 'unpaid' || a.status === 'pending')) || a.date <= endDate);
      }
    }

    // Apply additional filters
    if (doctor && doctor !== 'all') {
      filtered = filtered.filter(a => a.doctor === doctor);
    }
    if (type && type !== 'all') {
      filtered = filtered.filter(a => a.type === parseInt(type, 10));
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(a => (includeUnpaid === 'true' && (a.paymentStatus === 'unpaid' || a.status === 'pending')) || a.status === status);
    }

    if (isGlobal) {
      filtered = filtered.map(a => ({
        ...a,
        patientName: 'Occupied',
        patientId: 'Occupied',
        notes: '',
        email: '',
        phone: '',
        price: 0,
        balance: 0,
        totalPaid: 0,
        customType: a.type === APPOINTMENT_TYPES.length - 1 ? 'Other' : ''
      }));
    }

    res.json({
      success: true,
      message: "Appointments retrieved successfully",
      data: filtered,
    });
  } catch (error) {
    console.error("[APPOINTMENT GET] Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointmentById = (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    const { id } = req.params;
    const appointment = appointments.find((apt) => apt.id === id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.json({
      success: true,
      message: "Appointment retrieved successfully",
      data: appointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT GET_BY_ID] Error fetching appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateAppointment = (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    const { id } = req.params;
    const updates: Partial<Appointment> = req.body;

    const appointmentIndex = appointments.findIndex((apt) => apt.id === id);
    if (appointmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const updatedAppointment: Appointment = {
      ...appointments[appointmentIndex],
      ...updates,
      id: appointments[appointmentIndex].id, // Prevent ID change
      updatedAt: new Date(),
    };

    // Check for conflicts if date, time, duration, or doctor changed
    if (
      updates.date || 
      updates.time || 
      updates.duration !== undefined || 
      updates.doctor
    ) {
      if (hasConflict(
        appointments,
        updatedAppointment.date,
        updatedAppointment.time,
        updatedAppointment.duration || 60,
        updatedAppointment.doctor || "",
        id
      )) {
        return res.status(409).json({
          success: false,
          message: "Conflict detected: There is already an appointment scheduled during this time.",
        });
      }
    }

    const oldStatus = appointments[appointmentIndex].status;
    appointments[appointmentIndex] = updatedAppointment;
    writeData(COLLECTION, appointments);

    // Notify Patient if status changed
    if (updates.status && updates.status !== oldStatus) {
      createNotification(
        updatedAppointment.patientId,
        "Appointment Status Updated",
        `Your appointment on ${updatedAppointment.date} is now ${updatedAppointment.status}.`,
        "appointment",
        {
          appointmentId: updatedAppointment.id,
          currentStatus: updatedAppointment.status,
        }
      );
      
      // Notify Doctor if assigned
      if (updatedAppointment.doctor) {
        const staff = readData<any>("staff");
        const doctor = staff.find((s: any) => s.name === updatedAppointment.doctor);
        if (doctor) {
          createNotification(
            doctor.id,
            "Appointment Status Updated",
            `Appointment with ${updatedAppointment.patientName} on ${updatedAppointment.date} is now ${updatedAppointment.status}.`,
            "appointment",
            {
              appointmentId: updatedAppointment.id,
              currentStatus: updatedAppointment.status,
              patientName: updatedAppointment.patientName,
            }
          );
        }
      }
    }

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT UPDATE] Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteAppointment = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    const { id } = req.params;
    const appointmentIndex = appointments.findIndex((apt) => apt.id === id);

    if (appointmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // soft delete
    appointments[appointmentIndex] = {
      ...appointments[appointmentIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    writeData(COLLECTION, appointments);

    console.log("[APPOINTMENT DELETE] Soft-deleted appointment:", appointments[appointmentIndex]);

    res.json({
      success: true,
      message: "Appointment soft-deleted successfully",
    });
  } catch (error) {
    console.error("[APPOINTMENT DELETE] Error deleting appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const bookPublicAppointment = async (req: Request, res: Response<ApiResponse<Appointment>>) => {
  try {
    const appointments = readData<Appointment>(COLLECTION);
    const patients = readData<Patient>("patients");
    const { firstName, lastName, email, phone, date, time, duration, type, customType, doctor, notes, patientId, serviceType } = req.body;

    // Basic validation
    if (!firstName || !lastName || !phone || !date || !time || type == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: firstName, lastName, phone, date, time, type",
      });
    }

    // Search for existing patient by ID, phone or email
    let patient = patientId ? patients.find(p => p.id === patientId) : patients.find(p => p.phone === phone || (email && p.email === email));

    if (!patient) {
      // Default password for new patients created via booking
      const passwordHash = await bcrypt.hash("villahermosa123", 10);

      // Create new patient
      patient = {
        id: `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email: email || "",
        phone,
        password: passwordHash,
        dateOfBirth: "",
        address: "",
        city: "",
        zipCode: "",
        emergencyContact: "",
        emergencyPhone: "",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false,
      };
      patients.push(patient);
      writeData("patients", patients);
      console.log("[PUBLIC BOOKING] Created new patient:", patient.id);
    } else {
      console.log("[PUBLIC BOOKING] Found existing patient:", patient.id);
    }

    // Check for conflicts
    if (hasConflict(
      appointments,
      date,
      time,
      duration || 30, // Use provided duration or default to 30
      doctor || ""
    )) {
      return res.status(409).json({
        success: false,
        message: "The selected time is no longer available. Please choose another time.",
      });
    }

    const basePrice = getAppointmentPrice(type);

    // Create appointment
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: patient.id!,
      patientName: `${patient.firstName} ${patient.lastName}`,
      date,
      time,
      duration: duration || 30,
      type,
      customType: customType || "",
      price: basePrice,
      doctor: doctor || "",
      notes: notes || "",
      serviceType: serviceType || "",
      status: "pending", // Public bookings are pending by default
      paymentStatus: "unpaid",
      balance: basePrice,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);

    // Notify Admin & Doctor of new public booking
    const isRequest = ["pending", "tentative", "To Pay"].includes(newAppointment.status as string);

    if (newAppointment.paymentStatus !== "unpaid" || isRequest) {
      notifyAdmin(
        isRequest ? "New Public Booking Request" : "New Public Booking",
        `${newAppointment.patientName} has booked a ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} appointment for ${newAppointment.date} at ${newAppointment.time} via the public portal.`,
        "appointment",
        {
          appointmentId: newAppointment.id,
          currentStatus: newAppointment.status,
          patientName: newAppointment.patientName,
          isRequest: isRequest
        }
      );

      // Also notify the doctor specifically
      if (newAppointment.doctor) {
        const staff = readData<any>("staff");
        const doctor = staff.find((s: any) => s.name === newAppointment.doctor);
        if (doctor) {
          createNotification(
            doctor.id,
            isRequest ? "New Public Booking Request" : "New Public Booking",
            `${newAppointment.patientName} has booked a ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} appointment for ${newAppointment.date} at ${newAppointment.time} via the public portal.`,
            "appointment",
            {
              appointmentId: newAppointment.id,
              currentStatus: newAppointment.status,
              patientName: newAppointment.patientName,
              isRequest: isRequest
            }
          );
        }
      }
    }

    // Notify Patient (Welcome/Confirmation)
    createNotification(
      patient.id!,
      "Appointment Request Received",
      `Your request for a ${getAppointmentTypeName(newAppointment.type, newAppointment.customType)} appointment on ${newAppointment.date} at ${newAppointment.time} has been received and is pending confirmation.`,
      "appointment",
      {
        appointmentId: newAppointment.id,
        currentStatus: newAppointment.status,
      }
    );

    res.status(201).json({
      success: true,
      message: "Appointment requested successfully. We will contact you to confirm.",
      data: newAppointment,
    });
  } catch (error) {
    console.error("[PUBLIC BOOKING] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error processing your appointment request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
