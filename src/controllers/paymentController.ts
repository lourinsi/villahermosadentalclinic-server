import { Request, Response } from "express";
import { Payment, ApiResponse } from "../types/payment";
import { hasConflict } from "../utils/appointment-helpers";
import {
  notifyAdmin,
  notifyPaymentReceived,
  notifyStatusChange,
  resolveRecipients,
} from "../utils/notifications";
import { getAppointmentTypeName } from "../utils/appointment-types";
import { createAppointmentLog } from "../utils/appointmentLogs";
import { createPaymentLog } from "../utils/paymentLogs";
import { readAppointmentsWithLifecycle } from "../utils/appointmentStatusLifecycle";
import { prisma } from "../lib/prisma";
import {
  isPatientCartStatus,
  normalizeStatus,
} from "../constants/appointmentStatuses";

const toPayment = (payment: unknown): Payment => payment as Payment;
const toAppointment = (appointment: unknown): any => appointment as any;

const paymentStatusFor = (totalPaid: number, balance: number): string => {
  if (balance <= 0) return "paid";
  if (totalPaid > 0) return "half-paid";
  return "unpaid";
};

const appointmentData = (appointment: any) => ({
  patientName: appointment.patientName,
  date: appointment.date,
  time: appointment.time,
  type: getAppointmentTypeName(appointment.type, appointment.customType),
  doctor: appointment.doctor,
});

const isStaffRole = (req: Request): boolean => {
  const role = String((req as any).user?.role || "").toLowerCase();
  return role === "admin" || role === "doctor";
};

const isCashPaymentMethod = (method: unknown): boolean =>
  String(method || "").trim().toLowerCase() === "cash";

export const createPayment = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { appointmentId, patientId, amount, method, date, transactionId, notes } = req.body;
    if (!appointmentId || amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "Missing appointmentId or invalid amount" });
    }
    if (isCashPaymentMethod(method) && !isStaffRole(req)) {
      return res.status(403).json({ success: false, message: "Cash payments can only be recorded by admins or doctors" });
    }

    const appointment = toAppointment(
      await prisma.appointment.findUnique({ where: { id: appointmentId } })
    );
    if (!appointment || appointment.deleted) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (transactionId) {
      const existing = await prisma.payment.findFirst({
        where: { transactionId, deleted: false },
      });
      if (existing) {
        return res.json({
          success: true,
          message: "Payment already exists",
          data: { payment: toPayment(existing) },
        });
      }
    }

    const payAmount = Number(amount);
    const isPayAtClinic = method === "Pay at Clinic";
    const newPaymentData = {
      id: `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      appointmentId,
      patientId: patientId || appointment.patientId,
      amount: payAmount,
      method: method || "unknown",
      date: date || new Date().toISOString().split("T")[0],
      transactionId:
        transactionId ||
        `${isPayAtClinic ? "PAC" : "T"}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      notes: notes || (isPayAtClinic ? "Cash upon appointment" : ""),
      status: isPayAtClinic && payAmount === 0 ? "pending" : "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    const newPayment =
      !isPayAtClinic || payAmount > 0
        ? toPayment(await prisma.payment.create({ data: newPaymentData }))
        : (newPaymentData as Payment);

    const oldAppointment = { ...appointment };
    const totalPaid = (appointment.totalPaid || 0) + payAmount;
    const balance = (appointment.price || 0) - (appointment.discount || 0) - totalPaid;
    const oldStatus = normalizeStatus(appointment.status);
    const oldPaymentStatus = appointment.paymentStatus || "unpaid";
    let newStatus = appointment.status;
    const newPaymentStatus = paymentStatusFor(totalPaid, balance);

    if (isPatientCartStatus(appointment.status)) {
      const appointments = await readAppointmentsWithLifecycle();
      const conflict = hasConflict(
        appointments,
        appointment.date,
        appointment.time,
        appointment.duration || 60,
        appointment.doctor || "",
        appointment.id
      );

      if (conflict) {
        await notifyAdmin(
          "Appointment Conflict Detected",
          `${appointment.patientName} tried to confirm an appointment on ${appointment.date} at ${appointment.time}, but this slot is already taken.`,
          "appointment",
          { appointmentId: appointment.id, patientName: appointment.patientName }
        );
      } else if (!isPayAtClinic) {
        if (newPaymentStatus === "paid") newStatus = "scheduled";
        else if (newPaymentStatus === "half-paid") newStatus = "reserved";
      }
    }

    const updatedAppointment = toAppointment(
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          totalPaid,
          balance,
          paymentStatus: newPaymentStatus,
          status: newStatus,
          updatedAt: new Date(),
        },
      })
    );

    const changedBy = (req as any).user?.id || (req as any).user?.username || "admin";
    const changedByName =
      (req as any).user?.name ||
      (req as any).user?.username ||
      (changedBy === "admin" ? "Admin" : changedBy);

    await createAppointmentLog(
      appointmentId,
      oldAppointment,
      updatedAppointment,
      changedBy,
      changedByName,
      "payment",
      payAmount,
      notes
    );

    if (payAmount > 0) {
      await createPaymentLog(
        appointmentId,
        payAmount,
        method || "unknown",
        updatedAppointment.paymentStatus || "unpaid",
        changedBy,
        oldAppointment.balance || 0,
        updatedAppointment.balance || 0,
        changedByName
      );
    }

    const recipients = await resolveRecipients(updatedAppointment);
    if (updatedAppointment.status !== oldStatus) {
      await notifyStatusChange(
        appointmentId,
        "status",
        oldStatus,
        updatedAppointment.status,
        recipients,
        appointmentData(updatedAppointment)
      );
    }
    if (updatedAppointment.paymentStatus !== oldPaymentStatus) {
      await notifyStatusChange(
        appointmentId,
        "payment",
        oldPaymentStatus,
        updatedAppointment.paymentStatus,
        recipients,
        appointmentData(updatedAppointment)
      );
    }
    if (payAmount > 0) {
      await notifyPaymentReceived(
        appointmentId,
        payAmount,
        recipients,
        appointmentData(updatedAppointment),
        newPayment.id
      );
    }

    await prisma.patient.updateMany({
      where: { id: patientId || appointment.patientId },
      data: { balance: { decrement: payAmount }, updatedAt: new Date() },
    });

    // Persist an immutable appointment snapshot on the payment record (if payment persisted)
    try {
      if (newPayment && (newPayment as any).id) {
        await prisma.payment.update({
          where: { id: (newPayment as any).id },
          data: { appointmentSnapshot: updatedAppointment },
        });
        // refresh newPayment object to include appointmentSnapshot
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        // (we intentionally keep types loose for snapshot payload)
        // Note: ignore result; returning object below will include updated appointment from DB
      }
    } catch (err) {
      console.warn("Failed to attach appointmentSnapshot to payment record:", err);
    }

    await prisma.financeRecord.create({
      data: {
        id: `fin_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        patientId: newPayment.patientId,
        type: "payment",
        amount: newPayment.amount,
        date: newPayment.date,
        description: `Payment ${newPayment.id} for appointment ${appointmentId}`,
        appointmentSnapshot: updatedAppointment,
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false,
      },
    });

    res.status(201).json({
      success: true,
      message: "Payment created",
      data: { payment: newPayment, appointment: updatedAppointment },
    });
  } catch (error) {
    console.error("[CREATE PAYMENT] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const getPaymentsByAppointment = async (
  req: Request,
  res: Response<ApiResponse<Payment[]>>
) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { deleted: false, appointmentId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: payments.map(toPayment) });
  } catch (error) {
    console.error("[GET PAYMENTS] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const getPaymentsByPatient = async (
  req: Request,
  res: Response<ApiResponse<Payment[]>>
) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { deleted: false, patientId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: payments.map(toPayment) });
  } catch (error) {
    console.error("[GET PAYMENTS PATIENT] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const updatePayment = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    const { amount, method, date, transactionId, notes, appointmentId } = req.body;

    const oldPayment = toPayment(await prisma.payment.findUnique({ where: { id } }));
    if (!oldPayment || oldPayment.deleted) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const updatedPayment = toPayment(
      await prisma.payment.update({
        where: { id },
        data: {
          amount: amount !== undefined ? Number(amount) : oldPayment.amount,
          method: method || oldPayment.method,
          date: date || oldPayment.date,
          transactionId: transactionId || oldPayment.transactionId,
          notes: notes !== undefined ? notes : oldPayment.notes,
          appointmentId: appointmentId || oldPayment.appointmentId,
          updatedAt: new Date(),
        },
      })
    );

    const amountDiff = updatedPayment.amount - oldPayment.amount;
    if (amountDiff !== 0) {
      const appointment = toAppointment(
        await prisma.appointment.findUnique({ where: { id: oldPayment.appointmentId } })
      );
      if (appointment) {
        const oldAppointment = { ...appointment };
        const totalPaid = Math.max(0, (appointment.totalPaid || 0) + amountDiff);
        const balance = (appointment.price || 0) - (appointment.discount || 0) - totalPaid;
        const oldPaymentStatus = appointment.paymentStatus || "unpaid";
        const newPaymentStatus = paymentStatusFor(totalPaid, balance);
        const savedAppointment = toAppointment(
          await prisma.appointment.update({
            where: { id: oldPayment.appointmentId },
            data: { totalPaid, balance, paymentStatus: newPaymentStatus, updatedAt: new Date() },
          })
        );

        const changedBy = (req as any).user?.id || (req as any).user?.username || "admin";
        const changedByName =
          (req as any).user?.name ||
          (req as any).user?.username ||
          (changedBy === "admin" ? "Admin" : changedBy);
        await createAppointmentLog(
          oldPayment.appointmentId,
          oldAppointment,
          savedAppointment,
          changedBy,
          changedByName,
          "payment",
          amountDiff,
          notes
        );

        await createPaymentLog(
          oldPayment.appointmentId,
          amountDiff,
          updatedPayment.method || oldPayment.method || "unknown",
          savedAppointment.paymentStatus || "unpaid",
          changedBy,
          oldAppointment.balance || 0,
          savedAppointment.balance || 0,
          changedByName
        );

        const recipients = await resolveRecipients(savedAppointment);
        if (amountDiff > 0) {
          await notifyPaymentReceived(oldPayment.appointmentId, amountDiff, recipients, appointmentData(savedAppointment), id);
        }
        if (savedAppointment.paymentStatus !== oldPaymentStatus) {
          await notifyStatusChange(
            oldPayment.appointmentId,
            "payment",
            oldPaymentStatus,
            savedAppointment.paymentStatus,
            recipients,
            appointmentData(savedAppointment)
          );
        }
      }

      await prisma.patient.updateMany({
        where: { id: oldPayment.patientId || undefined },
        data: { balance: { decrement: amountDiff }, updatedAt: new Date() },
      });

      await prisma.financeRecord.updateMany({
        where: { description: { contains: `Payment ${id}` } },
        data: { amount: updatedPayment.amount, updatedAt: new Date() },
      });
    }

    res.json({ success: true, message: "Payment updated", data: { payment: updatedPayment } });
  } catch (error) {
    console.error("[UPDATE PAYMENT] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const deletePayment = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    const payment = toPayment(await prisma.payment.findUnique({ where: { id } }));
    if (!payment || payment.deleted) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    await prisma.payment.update({
      where: { id },
      data: { deleted: true, updatedAt: new Date() },
    });

    const appointment = toAppointment(
      await prisma.appointment.findUnique({ where: { id: payment.appointmentId } })
    );
    if (appointment) {
      const oldAppointment = { ...appointment };
      const totalPaid = Math.max(0, (appointment.totalPaid || 0) - payment.amount);
      const balance = (appointment.price || 0) - (appointment.discount || 0) - totalPaid;
      const oldPaymentStatus = appointment.paymentStatus || "unpaid";
      const newPaymentStatus = paymentStatusFor(totalPaid, balance);
      const savedAppointment = toAppointment(
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { totalPaid, balance, paymentStatus: newPaymentStatus, updatedAt: new Date() },
        })
      );

      const changedBy = (req as any).user?.id || (req as any).user?.username || "admin";
      const changedByName =
        (req as any).user?.name ||
        (req as any).user?.username ||
        (changedBy === "admin" ? "Admin" : changedBy);
      await createAppointmentLog(
        payment.appointmentId,
        oldAppointment,
        savedAppointment,
        changedBy,
        changedByName,
        "payment",
        -payment.amount,
        "Payment deleted"
      );

      await createPaymentLog(
        payment.appointmentId,
        -payment.amount,
        payment.method || "unknown",
        savedAppointment.paymentStatus || "unpaid",
        changedBy,
        oldAppointment.balance || 0,
        savedAppointment.balance || 0,
        changedByName
      );

      if (savedAppointment.paymentStatus !== oldPaymentStatus) {
        await notifyStatusChange(
          payment.appointmentId,
          "payment",
          oldPaymentStatus,
          savedAppointment.paymentStatus,
          await resolveRecipients(savedAppointment),
          appointmentData(savedAppointment)
        );
      }
    }

    await prisma.patient.updateMany({
      where: { id: payment.patientId || undefined },
      data: { balance: { increment: payment.amount }, updatedAt: new Date() },
    });

    await prisma.financeRecord.updateMany({
      where: { description: { contains: `Payment ${id}` } },
      data: { deleted: true, updatedAt: new Date() },
    });

    res.json({
      success: true,
      message: "Payment deleted successfully",
      data: { payment: { ...payment, deleted: true } },
    });
  } catch (error) {
    console.error("[DELETE PAYMENT] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting payment",
      error: error instanceof Error ? error.message : error,
    });
  }
};
