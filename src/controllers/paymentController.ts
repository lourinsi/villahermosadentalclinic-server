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
      
      // Automatically schedule the appointment if it was pending
      if (apt.status === 'pending') {
        apt.status = 'scheduled';
      }

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

export const updatePayment = (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    const { amount, method, date, transactionId, notes, appointmentId } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }

    const payments = readData<Payment>(COLLECTION);
    const paymentIndex = payments.findIndex(p => p.id === id && !p.deleted);

    if (paymentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const oldPayment = payments[paymentIndex];
    const oldAmount = oldPayment.amount;
    const oldAppointmentId = oldPayment.appointmentId;

    // Update payment
    const updatedPayment: Payment = {
      ...oldPayment,
      amount: amount !== undefined ? Number(amount) : oldPayment.amount,
      method: method || oldPayment.method,
      date: date || oldPayment.date,
      transactionId: transactionId || oldPayment.transactionId,
      notes: notes !== undefined ? notes : oldPayment.notes,
      appointmentId: appointmentId || oldPayment.appointmentId,
      updatedAt: new Date(),
    };

    payments[paymentIndex] = updatedPayment;
    writeData(COLLECTION, payments);

    // Update appointment aggregates if amount changed
    if (amount !== undefined && Number(amount) !== oldAmount) {
      const appointments = readData<Appointment>('appointments');
      const aptIndex = appointments.findIndex(a => a.id === oldAppointmentId);
      if (aptIndex !== -1) {
        const apt = appointments[aptIndex];
        const amountDiff = Number(amount) - oldAmount;
        apt.totalPaid = (apt.totalPaid || 0) + amountDiff;
        apt.balance = (apt.balance != null ? apt.balance : (apt.price || 0)) - amountDiff;
        if (apt.balance <= 0) apt.paymentStatus = 'paid';
        else if (apt.totalPaid === 0) apt.paymentStatus = 'unpaid';
        else apt.paymentStatus = apt.balance < (apt.price || 0) ? 'half-paid' : 'unpaid';
        apt.updatedAt = new Date();
        appointments[aptIndex] = apt;
        writeData('appointments', appointments);
      }

      // Update patient balance
      const patients = readData<Patient>('patients');
      const pIdx = patients.findIndex(p => p.id === oldPayment.patientId);
      if (pIdx !== -1) {
        const pat = patients[pIdx];
        (pat as any).balance = ((pat as any).balance || 0) - (Number(amount) - oldAmount);
        pat.updatedAt = new Date();
        patients[pIdx] = pat;
        writeData('patients', patients);
      }

      // Update finance record
      const finance = readData<any>('finance_records');
      const finIndex = finance.findIndex((f: any) => f.description?.includes(`Payment ${id}`));
      if (finIndex !== -1) {
        finance[finIndex].amount = Number(amount);
        finance[finIndex].updatedAt = new Date();
        writeData('finance_records', finance);
      }
    }

    // If appointmentId changed, update both old and new appointments
    if (appointmentId && appointmentId !== oldAppointmentId) {
      const appointments = readData<Appointment>('appointments');
      
      // Remove amount from old appointment
      const oldAptIndex = appointments.findIndex(a => a.id === oldAppointmentId);
      if (oldAptIndex !== -1) {
        const oldApt = appointments[oldAptIndex];
        oldApt.totalPaid = Math.max(0, (oldApt.totalPaid || 0) - oldAmount);
        oldApt.balance = (oldApt.balance != null ? oldApt.balance : (oldApt.price || 0)) + oldAmount;
        if (oldApt.balance <= 0) oldApt.paymentStatus = 'paid';
        else if (oldApt.totalPaid === 0) oldApt.paymentStatus = 'unpaid';
        else oldApt.paymentStatus = oldApt.balance < (oldApt.price || 0) ? 'half-paid' : 'unpaid';
        oldApt.updatedAt = new Date();
        appointments[oldAptIndex] = oldApt;
      }
      
      // Add amount to new appointment
      const newAptIndex = appointments.findIndex(a => a.id === appointmentId);
      if (newAptIndex !== -1) {
        const newApt = appointments[newAptIndex];
        newApt.totalPaid = (newApt.totalPaid || 0) + (amount || oldAmount);
        newApt.balance = (newApt.balance != null ? newApt.balance : (newApt.price || 0)) - (amount || oldAmount);
        if (newApt.balance <= 0) newApt.paymentStatus = 'paid';
        else if (newApt.totalPaid === 0) newApt.paymentStatus = 'unpaid';
        else newApt.paymentStatus = newApt.balance < (newApt.price || 0) ? 'half-paid' : 'unpaid';
        newApt.updatedAt = new Date();
        appointments[newAptIndex] = newApt;
      }
      
      writeData('appointments', appointments);
    }

    res.json({ success: true, message: 'Payment updated', data: { payment: updatedPayment } });
  } catch (error) {
    console.error('[UPDATE PAYMENT] Error:', error);
    res.status(500).json({ success: false, message: 'Error updating payment', error: error instanceof Error ? error.message : error });
  }
};

export const deletePayment = (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    console.log("[DELETE PAYMENT] Request received for ID:", id);

    if (!id) {
      console.log("[DELETE PAYMENT] Missing ID");
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }

    const payments = readData<Payment>(COLLECTION);
    console.log("[DELETE PAYMENT] Total payments in database:", payments.length);
    
    const paymentIndex = payments.findIndex(p => p.id === id && !p.deleted);
    console.log("[DELETE PAYMENT] Payment index found:", paymentIndex);

    if (paymentIndex === -1) {
      console.log("[DELETE PAYMENT] Payment not found with ID:", id);
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const deletedPayment = payments[paymentIndex];
    console.log("[DELETE PAYMENT] Found payment:", {
      id: deletedPayment.id,
      amount: deletedPayment.amount,
      appointmentId: deletedPayment.appointmentId,
      patientId: deletedPayment.patientId
    });
    
    const paymentAmount = deletedPayment.amount;
    const appointmentId = deletedPayment.appointmentId;

    // Mark payment as deleted (soft delete)
    deletedPayment.deleted = true;
    deletedPayment.updatedAt = new Date();
    payments[paymentIndex] = deletedPayment;
    writeData(COLLECTION, payments);
    console.log("[DELETE PAYMENT] Payment marked as deleted");

    // Update appointment aggregates - remove the payment amount
    const appointments = readData<Appointment>('appointments');
    const aptIndex = appointments.findIndex(a => a.id === appointmentId);
    console.log("[DELETE PAYMENT] Appointment index:", aptIndex);
    
    if (aptIndex !== -1) {
      const apt = appointments[aptIndex];
      console.log("[DELETE PAYMENT] Before update - totalPaid:", apt.totalPaid, "balance:", apt.balance);
      
      apt.totalPaid = Math.max(0, (apt.totalPaid || 0) - paymentAmount);
      apt.balance = (apt.balance != null ? apt.balance : (apt.price || 0)) + paymentAmount;
      if (apt.balance <= 0) apt.paymentStatus = 'paid';
      else if (apt.totalPaid === 0) apt.paymentStatus = 'unpaid';
      else apt.paymentStatus = apt.balance < (apt.price || 0) ? 'half-paid' : 'unpaid';
      apt.updatedAt = new Date();
      appointments[aptIndex] = apt;
      
      console.log("[DELETE PAYMENT] After update - totalPaid:", apt.totalPaid, "balance:", apt.balance, "status:", apt.paymentStatus);
      writeData('appointments', appointments);
    }

    // Update patient balance
    const patients = readData<Patient>('patients');
    const pIdx = patients.findIndex(p => p.id === deletedPayment.patientId);
    console.log("[DELETE PAYMENT] Patient index:", pIdx);
    
    if (pIdx !== -1) {
      const pat = patients[pIdx];
      (pat as any).balance = ((pat as any).balance || 0) + paymentAmount;
      pat.updatedAt = new Date();
      patients[pIdx] = pat;
      console.log("[DELETE PAYMENT] Patient balance updated to:", (pat as any).balance);
      writeData('patients', patients);
    }

    // Mark finance record as deleted
    const finance = readData<any>('finance_records');
    const finIndex = finance.findIndex((f: any) => f.description?.includes(`Payment ${id}`));
    console.log("[DELETE PAYMENT] Finance record index:", finIndex);
    
    if (finIndex !== -1) {
      finance[finIndex].deleted = true;
      finance[finIndex].updatedAt = new Date();
      writeData('finance_records', finance);
      console.log("[DELETE PAYMENT] Finance record marked as deleted");
    }

    console.log("[DELETE PAYMENT] Deletion successful");
    res.json({ success: true, message: 'Payment deleted successfully', data: { payment: deletedPayment } });
  } catch (error) {
    console.error('[DELETE PAYMENT] Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting payment', error: error instanceof Error ? error.message : error });
  }
};
