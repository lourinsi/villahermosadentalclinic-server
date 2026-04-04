import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Appointment, ApiResponse } from "../types/appointment";
import { APPOINTMENT_TYPES, getAppointmentTypeName, getAppointmentPrice } from "../utils/appointment-types";
import { readData, writeData } from "../utils/storage";
import { hasConflict } from "../utils/appointment-helpers";
import { FinanceRecord } from "../types/finance";
import { Patient } from "../types/patient";
import { normalizeStatus } from "../constants/appointmentStatuses";
import { 
  notifyAppointmentChange,
  notifyStatusChange,
  updateNotificationMetadata
} from "../utils/notifications";

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
    // First, check for same-patient overlap (patient cannot be double-booked)
    const timeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(":").map(Number);
      return (hours || 0) * 60 + (minutes || 0);
    };

    const newStart = timeToMinutes(appointmentData.time);
    const newDuration = Number(appointmentData.duration) || 60;
    const newEnd = newStart + newDuration;
    const isSeeding = req.body.isSeeding === true;

    const hasOverlapSamePatient = !isSeeding && appointments.some(apt => {
      if (apt.deleted || apt.id === appointmentData.id || apt.date !== appointmentData.date) return false;
      if (apt.patientId === appointmentData.patientId) {
        const aptStart = timeToMinutes(apt.time);
        const aptEnd = aptStart + (Number(apt.duration) || 60);
        return newStart < aptEnd && newEnd > aptStart;
      }
      return false;
    });

    if (hasOverlapSamePatient) {
      return res.status(409).json({
        success: false,
        message: "Conflict detected: Patient has another appointment during this time.",
      });
    }

    // Then check doctor-specific conflicts (existing behavior)
    if (!isSeeding && hasConflict(
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
    const discount = Number(appointmentData.discount) || 0;
    const price = appointmentData.price || basePrice;
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: appointmentData.patientId,
      patientName: appointmentData.patientName,
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type,
      customType: appointmentData.customType || "",
      price,
      discount,
      doctor: appointmentData.doctor || "",
      duration: appointmentData.duration || 60, // default to 60 minutes
      notes: appointmentData.notes || "",
      status: appointmentData.status || "scheduled",
      paymentStatus: appointmentData.paymentStatus || "unpaid",
      totalPaid: appointmentData.totalPaid || 0,
      balance: appointmentData.balance != null ? appointmentData.balance : Math.max(0, price - discount),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    console.log("[APPOINTMENT CREATE] New appointment object created:", newAppointment);
    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);
    console.log("[APPOINTMENT CREATE] Appointment saved. Total appointments:", appointments.length);

    // Centralized notification logic
    notifyAppointmentChange(newAppointment, 'created');

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
        .map(p => p.id)
        .filter((id): id is string => id !== undefined);
      
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
      data: filtered.map(a => ({
        ...a,
        status: normalizeStatus(a.status || "pending")
      })),
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
      data: {
        ...appointment,
        status: normalizeStatus(appointment.status || "pending")
      },
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

    const oldAppointment = appointments[appointmentIndex];

    console.log("[APPOINTMENT UPDATE] appointmentId=", id);
    
    // Derive totalPaid if missing from legacy records
    const derivedTotalPaid = oldAppointment.totalPaid !== undefined 
      ? oldAppointment.totalPaid 
      : (oldAppointment.price !== undefined && oldAppointment.balance !== undefined 
        ? Math.max(0, oldAppointment.price - (oldAppointment.discount || 0) - oldAppointment.balance) 
        : 0);

    const updatedAppointment: Appointment = {
      ...oldAppointment,
      totalPaid: derivedTotalPaid,
      ...updates,
      id: oldAppointment.id, // Prevent ID change
      updatedAt: new Date(),
    };

    // Build a changedFields map early for logging and later notification use
    const changedFields: { [key: string]: any } = {};
    ['date', 'time', 'duration', 'doctor', 'type', 'customType', 'price', 'notes', 'status'].forEach((f) => {
      if ((updates as any)[f] !== undefined) changedFields[f] = (updates as any)[f];
    });

    console.log("[APPOINTMENT UPDATE] updatedAppointment=", JSON.stringify(updatedAppointment, null, 2));
    console.log("[APPOINTMENT UPDATE] changedFields=", JSON.stringify(changedFields, null, 2));

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

    // Recalculate balance if price or discount changed
    if ((updates as any).price !== undefined || (updates as any).discount !== undefined) {
      const price = (updatedAppointment.price || 0);
      const discount = (updatedAppointment as any).discount || 0;
      (updatedAppointment as any).balance = Math.max(0, price - discount - (updatedAppointment.totalPaid || 0));
    }

    const oldStatus = appointments[appointmentIndex].status || 'pending';
    const oldPaymentStatus = appointments[appointmentIndex].paymentStatus || 'unpaid';
    appointments[appointmentIndex] = updatedAppointment;
    writeData(COLLECTION, appointments);

    console.log("[APPOINTMENT UPDATE] Update request received:", {
      appointmentId: updatedAppointment.id,
      updates: updates,
      "updates.status exists": 'status' in updates,
      "updates.status value": updates.status,
      "updates.status type": typeof updates.status,
      "updates.status truthy": !!updates.status,
      oldStatus,
      newStatus: updates.status,
      statusChanged: updates.status && updates.status !== oldStatus,
      oldPaymentStatus,
      newPaymentStatus: updates.paymentStatus,
      paymentStatusChanged: updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus
    });

    // HYBRID NOTIFICATION STRATEGY
    // Create NEW notification for significant status/payment changes
    // Update existing notification for minor metadata changes only
    
    // Only trigger notifications if status or paymentStatus is being explicitly updated
    if (updates.status) {
      console.log("[APPOINTMENT UPDATE] ✓ CONDITION PASSED - Status update requested, triggering notifyStatusChange", {
        statusValue: updates.status,
        statusType: typeof updates.status
      });
      // SIGNIFICANT CHANGE: Status changed → Create NEW notifications for all parties
      const appointmentId = updatedAppointment.id || '';
      if (appointmentId) {
        // Convert doctor name to doctor ID for notifications
        let doctorId = updatedAppointment.doctor || '';
        if (doctorId) {
          const staff = readData<any>("staff");
          const doctorRecord = staff.find((s: any) => s.name === doctorId);
          if (doctorRecord && doctorRecord.id) {
            doctorId = doctorRecord.id;
          }
        }
        
        notifyStatusChange(
          appointmentId,
          'status',
          oldStatus,
          updates.status as string,
          [
            updatedAppointment.patientId,
            doctorId,
            'admin'
          ],
          {
            patientName: updatedAppointment.patientName,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            type: getAppointmentTypeName(updatedAppointment.type, updatedAppointment.customType),
            doctor: updatedAppointment.doctor
          }
        );
      }
    } else if (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus) {
      // SIGNIFICANT CHANGE: Payment status changed → Create NEW payment notifications
      const appointmentId = updatedAppointment.id || '';
      if (appointmentId) {
        notifyStatusChange(
          appointmentId,
          'payment',
          oldPaymentStatus,
          updates.paymentStatus as string,
          [
            updatedAppointment.patientId,
            'admin'
          ],
          {
            patientName: updatedAppointment.patientName,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            type: getAppointmentTypeName(updatedAppointment.type, updatedAppointment.customType),
            doctor: updatedAppointment.doctor
          }
        );
      }
    } else {
      // MINOR CHANGE: Only metadata changed (time, notes, spelling) → Update existing notification
      const detailFieldsChanged = (
        updates.date ||
        updates.time ||
        updates.duration !== undefined ||
        updates.doctor ||
        updates.type !== undefined ||
        updates.customType ||
        updates.notes
      );

      if (detailFieldsChanged) {
        const appointmentId = updatedAppointment.id || '';
        if (appointmentId) {
          // Update existing notification for each affected party
          [updatedAppointment.patientId, 'admin'].forEach(userId => {
            if (userId) {
              updateNotificationMetadata(
                userId,
                appointmentId,
                {
                  message: `Your appointment on ${updatedAppointment.date} at ${updatedAppointment.time} has been updated.`,
                  metadata: {
                    appointmentDate: updatedAppointment.date,
                    appointmentTime: updatedAppointment.time,
                    changedFields: {
                      date: updates.date,
                      time: updates.time,
                      doctor: updates.doctor,
                      notes: updates.notes,
                      updatedAt: new Date().toISOString()
                    }
                  }
                }
              );
            }
          });
        }
      }
    }

    console.log("[APPOINTMENT UPDATE] Branch determination summary:", {
      "if (updates.status)": !!updates.status,
      "else if (updates.paymentStatus && ...)": !!(updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus),
      "else (metadata)": !(updates.status || (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus))
    });

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

    const appointmentToDelete = appointments[appointmentIndex];
    const oldStatus = appointmentToDelete.status || 'pending';

    // soft delete
    appointments[appointmentIndex] = {
      ...appointments[appointmentIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    writeData(COLLECTION, appointments);

    console.log("[APPOINTMENT DELETE] Soft-deleted appointment:", appointments[appointmentIndex]);

    // NOTIFICATION: Notify all parties about the cancellation
    const appointmentId = appointmentToDelete.id || '';
    if (appointmentId) {
      // Convert doctor name to doctor ID for notifications
      let doctorId = appointmentToDelete.doctor || '';
      if (doctorId) {
        const staff = readData<any>("staff");
        const doctorRecord = staff.find((s: any) => s.name === doctorId);
        if (doctorRecord && doctorRecord.id) {
          doctorId = doctorRecord.id;
        }
      }
      
      notifyStatusChange(
        appointmentId,
        'status',
        oldStatus,
        'cancelled',
        [
          appointmentToDelete.patientId,
          doctorId,
          'admin'
        ],
        {
          patientName: appointmentToDelete.patientName,
          date: appointmentToDelete.date,
          time: appointmentToDelete.time,
          type: getAppointmentTypeName(appointmentToDelete.type, appointmentToDelete.customType),
          doctor: appointmentToDelete.doctor
        }
      );
    }

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
    const discount = 0;
    const price = getAppointmentPrice(type);
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: patient.id!,
      patientName: `${patient.firstName} ${patient.lastName}`,
      date,
      time,
      duration: duration || 30,
      type,
      customType: customType || "",
      price,
      discount,
      doctor: doctor || "",
      notes: notes || "",
      serviceType: serviceType || "",
      status: "pending", // Public bookings are pending by default
      paymentStatus: "unpaid",
      totalPaid: 0,
      balance: Math.max(0, price - discount),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);

    // Centralized notification logic
    notifyAppointmentChange(newAppointment, 'public_request');

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
