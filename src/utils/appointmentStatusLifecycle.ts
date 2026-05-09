import { Appointment } from "../types/appointment";
import { normalizeStatus } from "../constants/appointmentStatuses";
import { createAppointmentLog } from "./appointmentLogs";
import { readData, writeData } from "./storage";

const APPOINTMENTS_COLLECTION = "appointments";
const TBD_STATUS = "tbd";
const FINAL_STATUSES = new Set(["cancelled", "completed"]);
const EXCLUDED_PAST_STATUSES = new Set(["pending", "tentative"]);

interface LifecycleResult {
  updatedCount: number;
  updatedIds: string[];
}

const parseAppointmentEnd = (appointment: Appointment): Date | null => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointment.date || "");
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(appointment.time || "");

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] || 0);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const start = new Date(year, month - 1, day, hour, minute, second);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day ||
    start.getHours() !== hour ||
    start.getMinutes() !== minute ||
    start.getSeconds() !== second
  ) {
    return null;
  }

  const durationMinutes = Number(appointment.duration);
  const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;

  return new Date(start.getTime() + safeDuration * 60 * 1000);
};

const shouldMarkAppointmentAsTbd = (appointment: Appointment, now: Date): boolean => {
  if (appointment.deleted) {
    return false;
  }

  const rawStatus = (appointment.status || "").toLowerCase().trim();
  if (EXCLUDED_PAST_STATUSES.has(rawStatus)) {
    return false;
  }

  const normalizedStatus = normalizeStatus(appointment.status);
  if (FINAL_STATUSES.has(normalizedStatus) || normalizedStatus === TBD_STATUS) {
    return false;
  }

  const appointmentEnd = parseAppointmentEnd(appointment);
  return appointmentEnd !== null && appointmentEnd.getTime() < now.getTime();
};

export const markPastAppointmentsAsTbd = (
  appointments: Appointment[],
  now: Date = new Date()
): LifecycleResult => {
  const updatedIds: string[] = [];
  let updatedCount = 0;

  appointments.forEach((appointment) => {
    if (!shouldMarkAppointmentAsTbd(appointment, now)) {
      return;
    }

    const previousState: Appointment = { ...appointment };
    appointment.status = TBD_STATUS;
    appointment.updatedAt = now;
    updatedCount += 1;
    if (appointment.id) {
      updatedIds.push(appointment.id);
    }

    if (appointment.id) {
      createAppointmentLog(
        appointment.id,
        previousState,
        { ...appointment },
        "system",
        "System",
        "status_change",
        0,
        "Automatically marked TBD because the appointment time passed without completion or cancellation."
      );
    }
  });

  if (updatedCount > 0) {
    console.log(
      `[APPOINTMENT LIFECYCLE] Marked ${updatedCount} past appointment(s) as TBD: ${updatedIds.join(", ")}`
    );
  }

  return {
    updatedCount,
    updatedIds,
  };
};

export const syncPastAppointmentsToTbd = (now: Date = new Date()): LifecycleResult => {
  const appointments = readData<Appointment>(APPOINTMENTS_COLLECTION);
  const result = markPastAppointmentsAsTbd(appointments, now);

  if (result.updatedCount > 0) {
    writeData(APPOINTMENTS_COLLECTION, appointments);
  }

  return result;
};

export const readAppointmentsWithLifecycle = (now: Date = new Date()): Appointment[] => {
  const appointments = readData<Appointment>(APPOINTMENTS_COLLECTION);
  const result = markPastAppointmentsAsTbd(appointments, now);

  if (result.updatedCount > 0) {
    writeData(APPOINTMENTS_COLLECTION, appointments);
  }

  return appointments;
};
