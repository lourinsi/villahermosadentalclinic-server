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
  notifyPaymentReceived,
  updateNotificationMetadata,
  resolveRecipients
} from "../utils/notifications";
import { createAppointmentLog, getAppointmentLogs } from "../utils/appointmentLogs";
import { createPaymentLog, getPaymentLogs } from "../utils/paymentLogs";

const COLLECTION = "appointments";

const cancelOverlappingPendingAppointments = (
  appointments: Appointment[],
  newAppointment: Appointment,
  changedBy: string,
  changedByName?: string
) => {
  const normalizedNewStatus = normalizeStatus(newAppointment.status);
  if (normalizedNewStatus === "pending" || normalizedNewStatus === "cancelled") {
    console.log(`[APPOINTMENT OVERLAP] Skipping cancellation check: new appointment status is ${normalizedNewStatus}`);
    return false;
  }

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const normalizeDoctorName = (name: string) => (name || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();

  const newStart = timeToMinutes(newAppointment.time);
  const newEnd = newStart + (Number(newAppointment.duration) || 60);
  const newDate = newAppointment.date;
  const newDoctorNorm = normalizeDoctorName(newAppointment.doctor || "");

  console.log(`[APPOINTMENT OVERLAP] Checking for pending overlaps: newApt=${newAppointment.id} date=${newDate} time=${newAppointment.time} duration=${newAppointment.duration} doctor=${newAppointment.doctor} status=${newAppointment.status}`);

  let cancelledCount = 0;

  appointments.forEach((apt) => {
    if (
      !apt.deleted &&
      apt.id !== newAppointment.id &&
      apt.date === newDate &&
      normalizeStatus(apt.status) === "pending"
    ) {
      const isSamePatient = newAppointment.patientId && apt.patientId === newAppointment.patientId;
      const aptDoctorNorm = normalizeDoctorName(apt.doctor || "");
      const isSameDoctor = newDoctorNorm && aptDoctorNorm && newDoctorNorm === aptDoctorNorm;

      if (isSamePatient || isSameDoctor) {
        const aptStart = timeToMinutes(apt.time);
        const aptDuration = Number(apt.duration) || 60;
        const aptEnd = aptStart + aptDuration;

        // Overlap condition: (newStart < aptEnd) && (newEnd > aptStart)
        if (newStart < aptEnd && newEnd > aptStart) {
          console.log(`[APPOINTMENT OVERLAP] Auto-cancelling pending appointment ${apt.id} for ${apt.patientName} overlapping with ${newAppointment.status} appointment ${newAppointment.id}`);
          
          const oldApt = { ...apt };
          apt.status = "cancelled";
          apt.updatedAt = new Date();
          cancelledCount++;

          // Log the cancellation
          createAppointmentLog(
            apt.id!,
            oldApt,
            apt,
            changedBy,
            changedByName || "System",
            "status_change",
            0,
            `Automatically cancelled due to overlap with a ${newAppointment.status} appointment`
          );

          // Notify about the cancellation
          const recipients = resolveRecipients(apt);
          notifyStatusChange(
            apt.id!,
            "status",
            "pending",
            "cancelled",
            recipients,
            {
              patientName: apt.patientName,
              date: apt.date,
              time: apt.time,
              type: getAppointmentTypeName(apt.type, apt.customType),
              doctor: apt.doctor,
            }
          );
        }
      }
    }
  });

  if (cancelledCount > 0) {
    console.log(`[APPOINTMENT OVERLAP] Cancelled ${cancelledCount} pending appointments.`);
    return true;
  }
  
  console.log(`[APPOINTMENT OVERLAP] No pending appointments found to cancel. Total appointments checked: ${appointments.length}`);
  return false;
};

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
    const isSeeding = req.body.isSeeding === true;

    if (!isSeeding && hasConflict(
      appointments, 
      appointmentData.date, 
      appointmentData.time, 
      appointmentData.duration || 60, 
      appointmentData.doctor || "",
      undefined,
      appointmentData.patientId
    )) {
      return res.status(409).json({
        success: false,
        message: "Conflict detected: Either the doctor or the patient is already busy during this time.",
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
    
    // Auto-cancel overlapping pending appointments
    const changedBy = (req as any).user?.id || (req as any).user?.username || 'admin';
    const changedByName = (req as any).user?.name || (req as any).user?.username || (changedBy === 'admin' ? 'Admin' : changedBy);
    const userRole = (req as any).user?.role || 'unknown';
    const userEmail = (req as any).user?.email || 'unknown';
    const userId = (req as any).user?.id || 'unknown';
    
    // ===== DETAILED CREATION LOGGING =====
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("[APPOINTMENT CREATE] ✅ NEW APPOINTMENT CREATED");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`📱 PORTAL: ${userRole === 'patient' ? 'PATIENT PORTAL' : userRole === 'doctor' ? 'DOCTOR PORTAL' : userRole === 'admin' ? 'ADMIN PORTAL' : 'UNKNOWN PORTAL'}`);
    console.log(`👤 CREATED BY: ${changedByName} (ID: ${userId})`);
    console.log(`📧 USER EMAIL: ${userEmail}`);
    console.log(`🔑 USER ROLE: ${userRole}`);
    console.log(`🏥 PATIENT: ${appointmentData.patientName}`);
    console.log(`👨‍⚕️ DOCTOR: ${appointmentData.doctor || 'Not assigned'}`);
    console.log(`📅 DATE: ${appointmentData.date}`);
    console.log(`⏰ TIME: ${appointmentData.time}`);
    console.log(`💰 PRICE: ${appointmentData.price || 0}`);
    console.log(`📌 STATUS: ${appointmentData.status || 'scheduled'}`);
    console.log(`⌛ APPOINTMENT ID: ${newAppointment.id}`);
    console.log("═══════════════════════════════════════════════════════════════");
    
    cancelOverlappingPendingAppointments(appointments, newAppointment, changedBy, changedByName);

    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);
    console.log("[APPOINTMENT CREATE] Appointment saved. Total appointments:", appointments.length);

    // Centralized notification logic
    notifyAppointmentChange(newAppointment, 'created');

    const recipients = resolveRecipients(newAppointment);
    console.log(`[APPOINTMENT CREATE] Final recipients list for payment: ${recipients.join(',')}`);

    // Payment status notification if not unpaid
    if (newAppointment.paymentStatus && newAppointment.paymentStatus !== 'unpaid') {
      notifyStatusChange(
        newAppointment.id || '',
        'payment',
        'unpaid',
        newAppointment.paymentStatus,
        recipients,
        {
          patientName: newAppointment.patientName,
          date: newAppointment.date,
          time: newAppointment.time,
          type: getAppointmentTypeName(newAppointment.type, newAppointment.customType),
          doctor: newAppointment.doctor
        }
      );
    }

    // LOG INITIAL CREATION
    const emptyState: any = { status: 'none', paymentStatus: 'none', price: 0, balance: 0, totalPaid: 0 };
    createAppointmentLog(
      newAppointment.id!, 
      emptyState, 
      newAppointment, 
      changedBy, 
      changedByName,
      'update', 
      newAppointment.totalPaid || 0,
      newAppointment.notes
    );

    // If initial payment, also log to dedicated payment logs
    if (newAppointment.totalPaid && newAppointment.totalPaid > 0) {
      createPaymentLog(
        newAppointment.id!,
        newAppointment.totalPaid,
        newAppointment.paymentMethod || 'cash',
        newAppointment.paymentStatus || 'unpaid',
        changedBy,
        newAppointment.price || 0, // previous balance was full price
        newAppointment.balance || 0,
        changedByName
      );
    }

    // Payment notification for specific amount if initial payment was made
    if (newAppointment.totalPaid && newAppointment.totalPaid > 0) {
      console.log(`[APPOINTMENT CREATE] Initial payment detected: ${newAppointment.totalPaid}. Triggering notifyPaymentReceived.`);
      notifyPaymentReceived(
        newAppointment.id || '',
        newAppointment.totalPaid,
        recipients,
        {
          patientName: newAppointment.patientName,
          date: newAppointment.date,
          time: newAppointment.time,
          type: getAppointmentTypeName(newAppointment.type, newAppointment.customType),
          doctor: newAppointment.doctor
        },
        `initial_${newAppointment.id}` // Use a unique ID for initial payment
      );
    }

    res.status(201).json({
      success: true,
      message: "Appointment added successfully",
      data: newAppointment,
      meta: {
        createdBy: {
          name: changedByName,
          id: userId,
          role: userRole,
          email: userEmail,
          portal: userRole === 'patient' ? 'PATIENT PORTAL' : userRole === 'doctor' ? 'DOCTOR PORTAL' : userRole === 'admin' ? 'ADMIN PORTAL' : 'UNKNOWN PORTAL',
          timestamp: new Date().toISOString()
        }
      }
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
    const { startDate, endDate, search, doctor, type, status, patientId, parentId, anonymize, includeUnpaid, matchType } = req.query as Record<string, string>;
    
    console.log('🔍 [getAppointments] Query params:', { includeUnpaid, status, doctor, type });
    console.log(`📊 [getAppointments] Total appointments in DB: ${appointments.length}`);
    console.log(`📋 [getAppointments] All statuses in DB: ${[...new Set(appointments.map(a => a.status))].join(', ')}`);
    
    // return only non-deleted appointments
    let filtered = appointments.filter(a => !a.deleted);
    console.log(`✅ [getAppointments] After excluding deleted: ${filtered.length}`);

    // Filter for Cart (pending) vs Bookings (non-pending)
    // Only exclude pending if not specifically requested and not in includeUnpaid mode
    if (includeUnpaid !== 'true' && status !== 'pending') {
      const pendingCount = filtered.filter(a => a.status === 'pending').length;
      console.log(`⚠️ [getAppointments] Excluding pending appointments (count: ${pendingCount})`);
      filtered = filtered.filter(a => a.status !== 'pending');
    }
    console.log(`📦 [getAppointments] After pending filter: ${filtered.length}`);
    const tdbCount = filtered.filter(a => a.status === 'tbd').length;
    console.log(`🎯 [getAppointments] TBD appointments count: ${tdbCount}`);
    if (tdbCount > 0) {
      console.log(`  TBD appointments:`, filtered.filter(a => a.status === 'tbd').map(a => ({ id: a.id, patient: a.patientName, date: a.date })));
    }

    const isGlobal = anonymize === 'true';

    // Handle Date range filtering first so it applies to both OR and AND logic
    if (startDate && startDate !== "") {
      filtered = filtered.filter(a => a.date >= startDate);
    }
    if (endDate && endDate !== "") {
      filtered = filtered.filter(a => a.date <= endDate);
    }

    // If search term is provided, prioritize searching (global search)
    if (search && search.trim() !== "") {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(a => 
        a.patientName.toLowerCase().includes(q) ||
        getAppointmentTypeName(a.type, a.customType).toLowerCase().includes(q) ||
        a.doctor.toLowerCase().includes(q)
      );
    } else if (matchType === 'or' && (doctor || patientId || parentId)) {
      // OR logic for availability overlap checks
      let familyIds: string[] = [];
      if (parentId && !isGlobal) {
        const patients = readData<Patient>("patients");
        familyIds = patients
          .filter(p => (p.parentId === parentId || p.id === parentId) && !p.deleted)
          .map(p => p.id)
          .filter((id): id is string => id !== undefined);
      }

      filtered = filtered.filter(a => {
        let match = false;
        
        if (doctor && doctor !== 'all') {
          if (a.doctor === doctor) match = true;
        }
        
        if (!isGlobal) {
          if (patientId && a.patientId === patientId) match = true;
          if (parentId && familyIds.includes(a.patientId)) match = true;
        }
        
        return match;
      });
    } else {
      // Standard AND logic (existing behavior)
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

      // Apply additional filters
      if (doctor && doctor !== 'all') {
        filtered = filtered.filter(a => a.doctor === doctor);
      }
    }

    // Apply common non-OR filters
    if (type && type !== 'all') {
      filtered = filtered.filter(a => a.type === parseInt(type, 10));
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(a => (includeUnpaid === 'true' && (a.paymentStatus === 'unpaid' || a.status === 'pending' || a.status === 'tbd')) || a.status === status);
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

    console.log(`✅ [getAppointments] Final filtered count: ${filtered.length}`);
    const finalTdbCount = filtered.filter(a => a.status === 'tbd').length;
    console.log(`🎯 [getAppointments] Final TBD count: ${finalTdbCount}`);
    const finalStatuses = [...new Set(filtered.map(a => a.status))];
    console.log(`📊 [getAppointments] Final statuses being returned: ${finalStatuses.join(', ')}`);

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

    const recipients = resolveRecipients({ ...oldAppointment, ...updates });
    console.log(`[APPOINTMENT UPDATE] Notification Recipients resolved: ${recipients.join(',')}`);

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

    const changedBy = (req as any).user?.id || (req as any).user?.username || 'admin';
    const changedByName = (req as any).user?.name || (req as any).user?.username || (changedBy === 'admin' ? 'Admin' : changedBy);

    // Auto-cancel overlapping pending appointments
    cancelOverlappingPendingAppointments(appointments, updatedAppointment, changedBy, changedByName);

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
        id,
        updatedAppointment.patientId
      )) {
        return res.status(409).json({
          success: false,
          message: "Conflict detected: Either the doctor or the patient is already busy during this time.",
        });
      }
    }

    // Recalculate balance if price or discount changed
    if ((updates as any).price !== undefined || (updates as any).discount !== undefined) {
      const price = (updatedAppointment.price || 0);
      const discount = (updatedAppointment as any).discount || 0;
      (updatedAppointment as any).balance = Math.max(0, price - discount - (updatedAppointment.totalPaid || 0));
    }

    const oldStatus = oldAppointment.status || 'pending';
    const oldPaymentStatus = oldAppointment.paymentStatus || 'unpaid';

    // Calculate payment amount early for logging
    const oldTotalPaidValue = derivedTotalPaid || 0;
    const newTotalPaidValue = updatedAppointment.totalPaid || 0;
    const paymentAmount = newTotalPaidValue - oldTotalPaidValue;

    // LOG THE EDIT: Archive previous state as a dedicated appointment log
    // We determine the change type based on what changed
    let logChangeType: any = 'update';
    
    // Check if schedule actually changed
    const dateChanged = updates.date && updates.date !== oldAppointment.date;
    const timeChanged = updates.time && updates.time !== oldAppointment.time;
    const isRescheduled = dateChanged || timeChanged;
    const notesChanged = updates.notes !== undefined && updates.notes !== oldAppointment.notes;

    if (paymentAmount > 0) {
      logChangeType = 'payment';
    } else if (updates.status && updates.status !== oldStatus) {
      logChangeType = 'status_change';
    } else if (isRescheduled) {
      logChangeType = 'rescheduled';
    } else if (notesChanged) {
      logChangeType = 'notes_update';
    } else if (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus) {
      logChangeType = 'payment';
    }

    createAppointmentLog(id, oldAppointment, updatedAppointment, changedBy, changedByName, logChangeType, paymentAmount, updates.notes);

    // If it's a payment, also create a dedicated payment log in its own collection
    if (paymentAmount > 0 || (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus)) {
      const prevBalance = oldAppointment.balance || 0;
      const newBalance = updatedAppointment.balance || 0;
      createPaymentLog(
        id, 
        paymentAmount > 0 ? paymentAmount : 0, 
        updatedAppointment.paymentMethod || 'cash', 
        updatedAppointment.paymentStatus || 'unpaid',
        changedBy,
        prevBalance,
        newBalance,
        changedByName
      );
    }

    appointments[appointmentIndex] = updatedAppointment;
    writeData(COLLECTION, appointments);

    // PAYMENT RECEIVED NOTIFICATION
    if (paymentAmount > 0) {
      console.log(`[APPOINTMENT UPDATE] Payment received: ${paymentAmount} (total: ${newTotalPaidValue}). Triggering notifyPaymentReceived.`);
      const appointmentId = updatedAppointment.id || '';
      if (appointmentId) {
        notifyPaymentReceived(
          appointmentId,
          paymentAmount,
          recipients,
          {
            patientName: updatedAppointment.patientName,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            type: getAppointmentTypeName(updatedAppointment.type, updatedAppointment.customType),
            doctor: updatedAppointment.doctor
          },
          `update_${appointmentId}_${Date.now()}` // Use a unique ID for update payment
        );
      }
    }

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
        notifyStatusChange(
          appointmentId,
          'status',
          oldStatus,
          updates.status as string,
          recipients,
          {
            patientName: updatedAppointment.patientName,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            type: getAppointmentTypeName(updatedAppointment.type, updatedAppointment.customType),
            doctor: updatedAppointment.doctor
          }
        );
      }
    }
    
    if (updates.paymentStatus && updates.paymentStatus !== oldPaymentStatus) {
      // SIGNIFICANT CHANGE: Payment status changed → Create NEW payment notifications
      const appointmentId = updatedAppointment.id || '';
      if (appointmentId) {
        notifyStatusChange(
          appointmentId,
          'payment',
          oldPaymentStatus,
          updates.paymentStatus as string,
          recipients,
          {
            patientName: updatedAppointment.patientName,
            date: updatedAppointment.date,
            time: updatedAppointment.time,
            type: getAppointmentTypeName(updatedAppointment.type, updatedAppointment.customType),
            doctor: updatedAppointment.doctor
          }
        );
      }
    }
    
    if (!updates.status && !updates.paymentStatus) {
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
          recipients.forEach(userId => {
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
      const recipients = resolveRecipients(appointmentToDelete);
      
      notifyStatusChange(
        appointmentId,
        'status',
        oldStatus,
        'cancelled',
        recipients,
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

    // LOG INITIAL CREATION
    createAppointmentLog(
      newAppointment.id!, 
      {} as any, 
      newAppointment, 
      'patient', // Public bookings are created by the patient
      `${firstName} ${lastName}`, // changedByName
      'update', // changeType
      undefined, // amount
      newAppointment.notes
    );

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

export const fetchAppointmentLogs = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Appointment ID is required" });
    }
    const logs = getAppointmentLogs(id);
    res.json({
      success: true,
      message: "Appointment logs retrieved successfully",
      data: logs,
    });
  } catch (error) {
    console.error("[APPOINTMENT LOGS GET] Error fetching logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const fetchPaymentLogs = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Appointment ID is required" });
    }
    const logs = getPaymentLogs(id);
    res.json({
      success: true,
      message: "Payment logs retrieved successfully",
      data: logs,
    });
  } catch (error) {
    console.error("[PAYMENT LOGS GET] Error fetching logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
