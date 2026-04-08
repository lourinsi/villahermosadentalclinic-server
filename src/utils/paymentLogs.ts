import { PaymentLog } from "../types/paymentLog";
import { readData, writeData } from "./storage";

const COLLECTION = "payment_logs";

/**
 * Creates a log entry for a payment update.
 */
export const createPaymentLog = (
  appointmentId: string,
  amount: number,
  paymentMethod: string,
  paymentStatus: string,
  changedBy: string,
  previousBalance: number,
  newBalance: number,
  changedByName?: string
): PaymentLog => {
  const logs = readData<PaymentLog>(COLLECTION);
  
  const newLog: PaymentLog = {
    id: `pay_log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    appointmentId,
    amount,
    paymentMethod,
    paymentStatus,
    changedBy,
    changedByName,
    changedAt: new Date().toISOString(),
    previousBalance,
    newBalance
  };

  console.log(`[paymentLogs] CREATING: id=${newLog.id} appointmentId=${appointmentId} amount=${amount} by=${changedByName || changedBy}`);
  logs.push(newLog);
  writeData(COLLECTION, logs);
  
  return newLog;
};

/**
 * Retrieves all payment logs for a specific appointment.
 */
export const getPaymentLogs = (appointmentId: string): PaymentLog[] => {
  const logs = readData<PaymentLog>(COLLECTION);
  return logs.filter(l => l.appointmentId === appointmentId);
};
