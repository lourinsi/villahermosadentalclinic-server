import { Request, Response } from "express";
import { Payment, ApiResponse } from "../types/payment";
import { readData, writeData } from "../utils/storage";
import { Appointment } from "../types/appointment";
import { Patient } from "../types/patient";

const COLLECTION = "payments";

export const createPayment = (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { appointmentId, patientId, amount, method, date, transactionId, notes } = req.body;
    if (!appointmentId || !amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Missing appointmentId or invalid amount' });
    }

    const payments = readData<Payment>(COLLECTION);
    const appointments = readData<Appointment>('appointments');

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Idempotency: check existing transactionId
    if (transactionId) {
      const existing = payments.find(p => p.transactionId === transactionId);
      if (existing) {
        return res.json({ success: true, message: 'Payment already exists', data: { payment: existing } });
      }
    }

    const payAmount = Number(amount);
    const newPayment: Payment = {
      id: `pay_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      appointmentId,
      patientId: patientId || appointment.patientId,
      amount: payAmount,
      method: method || 'unknown',
      date: date || new Date().toISOString().split('T')[0],
      transactionId: transactionId || `T-${Math.random().toString(36).slice(2,9).toUpperCase()}`,
      notes: notes || '',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    payments.push(newPayment);
    writeData(COLLECTION, payments);

    // update appointment aggregates
    const idx = appointments.findIndex(a => a.id === appointmentId);
    if (idx !== -1) {
      const apt = appointments[idx];
      apt.totalPaid = (apt.totalPaid || 0) + payAmount;
      apt.balance = (apt.balance != null ? apt.balance : (apt.price || 0)) - payAmount;
      if (apt.balance <= 0) apt.paymentStatus = 'paid';
      else if (apt.totalPaid === 0) apt.paymentStatus = 'unpaid';
      else apt.paymentStatus = apt.balance < (apt.price || 0) ? 'half-paid' : 'unpaid';
      apt.updatedAt = new Date();
      appointments[idx] = apt;
      writeData('appointments', appointments);
    }

    // update patient balance if present
    const patients = readData<Patient>('patients');
    const pIdx = patients.findIndex(p => p.id === (patientId || appointment.patientId));
    if (pIdx !== -1) {
      const pat = patients[pIdx];
      (pat as any).balance = ((pat as any).balance || 0) - payAmount;
      pat.updatedAt = new Date();
      patients[pIdx] = pat;
      writeData('patients', patients);
    }

    // also create finance record (reuse existing finance helpers pattern)
    const finance = readData<any>('finance_records');
    const financeRecord = {
      id: `fin_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      patientId: newPayment.patientId,
      type: 'payment',
      amount: newPayment.amount,
      date: newPayment.date,
      description: `Payment ${newPayment.id} for appointment ${appointmentId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };
    finance.push(financeRecord);
    writeData('finance_records', finance);

    res.status(201).json({ success: true, message: 'Payment created', data: { payment: newPayment, appointment } });
  } catch (error) {
    console.error('[CREATE PAYMENT] Error:', error);
    res.status(500).json({ success: false, message: 'Error creating payment', error: error instanceof Error ? error.message : error });
  }
};

export const getPaymentsByAppointment = (req: Request, res: Response<ApiResponse<Payment[]>>) => {
  try {
    const { id } = req.params; // appointment id
    const payments = readData<Payment>(COLLECTION);
    const filtered = payments.filter(p => !p.deleted && p.appointmentId === id);
    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('[GET PAYMENTS] Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments', error: error instanceof Error ? error.message : error });
  }
};

export const getPaymentsByPatient = (req: Request, res: Response<ApiResponse<Payment[]>>) => {
  try {
    const { id } = req.params; // patient id
    const payments = readData<Payment>(COLLECTION);
    const filtered = payments.filter(p => !p.deleted && p.patientId === id);
    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('[GET PAYMENTS PATIENT] Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments', error: error instanceof Error ? error.message : error });
  }
};
