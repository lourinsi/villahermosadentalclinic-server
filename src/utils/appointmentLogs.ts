import { AppointmentLog } from "../types/appointmentLog";
import { Appointment } from "../types/appointment";
import { readData, writeData } from "./storage";

const COLLECTION = "appointment_logs";

/**
 * Creates a log entry for an appointment edit.
 * This takes a snapshot of the appointment's state before and after the update.
 */
export const createAppointmentLog = (
  appointmentId: string,
  previousState: Appointment,
  newState: Partial<Appointment>,
  changedBy: string,
  changedByName?: string,
  changeType: AppointmentLog['changeType'] = 'update',
  amount?: number,
  notes?: string
): AppointmentLog => {
  const logs = readData<AppointmentLog>(COLLECTION);
  
  const newLog: AppointmentLog = {
    id: `apt_log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    appointmentId,
    previousState,
    newState,
    changedBy,
    changedByName,
    changedAt: new Date().toISOString(),
    changeType,
    amount,
    notes,
  };

  console.log(`[appointmentLogs] CREATING: id=${newLog.id} appointmentId=${appointmentId} changeType=${changeType} by=${changedByName || changedBy} amount=${amount}`);
  logs.push(newLog);
  writeData(COLLECTION, logs);
  
  return newLog;
};

/**
 * Retrieves all logs for a specific appointment.
 */
export const getAppointmentLogs = (appointmentId: string): AppointmentLog[] => {
  const logs = readData<AppointmentLog>(COLLECTION);
  return logs.filter(l => l.appointmentId === appointmentId);
};
