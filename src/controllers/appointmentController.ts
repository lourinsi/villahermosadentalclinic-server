import { Request, Response } from "express";
import { Appointment, ApiResponse } from "../types/appointment";
import { APPOINTMENT_TYPES, getAppointmentTypeName } from "../utils/appointment-types";
import { readData, writeData } from "../utils/storage";
import { FinanceRecord } from "../types/finance";
import { Patient } from "../types/patient";

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

    if (appointmentData.type === APPOINTMENT_TYPES.length - 1 && !appointmentData.customType) {
      return res.status(400).json({
        success: false,
        message: "Custom type description is required when 'Other' is selected.",
      });
    }


    console.log("[APPOINTMENT CREATE] Creating appointment for patient:", appointmentData.patientName);

    // Create appointment object with ID and timestamps
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: appointmentData.patientId,
      patientName: appointmentData.patientName,
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type,
      customType: appointmentData.customType || "",
      price: appointmentData.price || 0, // Default to 0 if not provided
      doctor: appointmentData.doctor || "",
      duration: appointmentData.duration || 60, // default to 60 minutes
      notes: appointmentData.notes || "",
      status: appointmentData.status || "scheduled",
      paymentStatus: appointmentData.paymentStatus || "unpaid",
      balance: appointmentData.balance != null ? appointmentData.balance : (appointmentData.price || 0),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    console.log("[APPOINTMENT CREATE] New appointment object created:", newAppointment);
    appointments.push(newAppointment);
    writeData(COLLECTION, appointments);
    console.log("[APPOINTMENT CREATE] Appointment saved. Total appointments:", appointments.length);

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
    const { startDate, endDate, search, doctor, type, status } = req.query as Record<string, string>;
    
    // return only non-deleted appointments
    let filtered = appointments.filter(a => !a.deleted);

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
      if (startDate) {
        filtered = filtered.filter(a => a.date >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter(a => a.date <= endDate);
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
      filtered = filtered.filter(a => a.status === status);
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

    appointments[appointmentIndex] = updatedAppointment;
    writeData(COLLECTION, appointments);

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

// Record a payment for an appointment and update appointment/patient records
export const recordPayment = (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params; // appointment id
    const { amount, method, date, transactionId, notes } = req.body;

  console.log('[RECORD PAYMENT] Incoming request for appointment:', id, 'body:', req.body);

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const appointments = readData<Appointment>(COLLECTION);
    const appointmentIndex = appointments.findIndex(a => a.id === id);
    if (appointmentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const appointment = appointments[appointmentIndex];
    const payAmount = Number(amount);

  console.log('[RECORD PAYMENT] Found appointment at index', appointmentIndex, 'current balance:', appointment.balance, 'totalPaid:', appointment.totalPaid);

    // initialize fields if missing
    appointment.totalPaid = (appointment.totalPaid || 0) + payAmount;
    appointment.balance = (appointment.balance != null ? appointment.balance : (appointment.price || 0)) - payAmount;
    if (appointment.balance <= 0) appointment.paymentStatus = 'paid';
    else if (appointment.totalPaid === 0) appointment.paymentStatus = 'unpaid';
    else appointment.paymentStatus = appointment.balance < (appointment.price || 0) ? 'half-paid' : 'unpaid';

    const txn = {
      id: `txn_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      amount: payAmount,
      method,
      date: date || new Date().toISOString().split('T')[0],
      transactionId: transactionId || `T-${Math.random().toString(36).slice(2,9).toUpperCase()}`,
      notes: notes || '',
      status: 'completed'
    };

    appointment.transactions = appointment.transactions || [];
    appointment.transactions.push(txn as any);
    appointment.updatedAt = new Date();

  appointments[appointmentIndex] = appointment;
  console.log('[RECORD PAYMENT] Writing appointments collection with updated appointment id', appointment.id);
  writeData(COLLECTION, appointments);
  console.log('[RECORD PAYMENT] writeData finished for appointments');

    // update patient balance if patient exists
    const patients = readData<Patient>('patients');
    const patientIndex = patients.findIndex(p => p.id === appointment.patientId);
    if (patientIndex !== -1) {
      const pat = patients[patientIndex];
      pat.updatedAt = new Date();
      // adjust patient-level balance field if present
      const currentBal = (pat as any).balance != null ? (pat as any).balance : 0;
      (pat as any).balance = currentBal - payAmount;
  patients[patientIndex] = pat;
  console.log('[RECORD PAYMENT] Writing patients collection, patient id', pat.id);
  writeData('patients', patients);
  console.log('[RECORD PAYMENT] writeData finished for patients');
    }

    // create a finance record for reporting
    const finance = readData<FinanceRecord>('finance_records');
    const financeRecord: FinanceRecord = {
      id: `fin_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      patientId: appointment.patientId,
      type: 'payment',
      amount: payAmount,
      date: date || new Date().toISOString().split('T')[0],
      description: `Payment for appointment ${appointment.id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };
    finance.push(financeRecord);
  console.log('[RECORD PAYMENT] Writing finance_records collection, record id', financeRecord.id);
  writeData('finance_records', finance);
  console.log('[RECORD PAYMENT] writeData finished for finance_records');

  console.log('[RECORD PAYMENT] Responding success for appointment', appointment.id, 'txn', txn.id);
  res.json({ success: true, message: 'Payment recorded', data: { appointment, transaction: txn } });
  } catch (error) {
    console.error('[RECORD PAYMENT] Error:', error);
    res.status(500).json({ success: false, message: 'Error recording payment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
