import { Appointment } from "../types/appointment";
import { normalizeStatus } from "../constants/appointmentStatuses";
import { createAppointmentLog } from "./appointmentLogs";
import { prisma } from "../lib/prisma";

const TBD_STATUS = "tbd";
const FINAL_STATUSES = new Set(["cancelled", "completed"]);
const PAST_APPOINTMENT_STATUSES = new Set([TBD_STATUS, ...FINAL_STATUSES]);

interface LifecycleResult {
  updatedCount: number;
  updatedIds: string[];
}

const toAppointment = (appointment: unknown): Appointment => appointment as Appointment;

const parseAppointmentDate = (dateValue?: string): Date | null => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const isPastAppointmentDate = (
  dateValue?: string,
  now: Date = new Date()
): boolean => {
  const appointmentDate = parseAppointmentDate(dateValue);
  if (!appointmentDate) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return appointmentDate.getTime() < today.getTime();
};

export const getPastRestrictedAppointmentStatus = (
  dateValue?: string,
  status?: string,
  now: Date = new Date()
): string => {
  if (!isPastAppointmentDate(dateValue, now)) return normalizeStatus(status || "scheduled");

  const normalizedStatus = normalizeStatus(status);
  return PAST_APPOINTMENT_STATUSES.has(normalizedStatus) ? normalizedStatus : TBD_STATUS;
};

const shouldMarkAppointmentAsTbd = (appointment: Appointment, now: Date): boolean => {
  if (appointment.deleted) return false;

  const normalizedStatus = normalizeStatus(appointment.status);
  if (FINAL_STATUSES.has(normalizedStatus) || normalizedStatus === TBD_STATUS) return false;

  return isPastAppointmentDate(appointment.date, now);
};

export const markPastAppointmentsAsTbd = async (
  appointments: Appointment[],
  now: Date = new Date()
): Promise<LifecycleResult> => {
  const updatedIds: string[] = [];

  for (const appointment of appointments) {
    if (!shouldMarkAppointmentAsTbd(appointment, now) || !appointment.id) continue;

    const previousState: Appointment = { ...appointment };
    appointment.status = TBD_STATUS;
    appointment.updatedAt = now;
    updatedIds.push(appointment.id);

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: TBD_STATUS, updatedAt: now },
    });

    await createAppointmentLog(
      appointment.id,
      previousState,
      { ...appointment },
      "system",
      "System",
      "status_change",
      0,
      "Automatically marked TBD because the appointment date passed without completion or cancellation."
    );
  }

  if (updatedIds.length > 0) {
    console.log(
      `[APPOINTMENT LIFECYCLE] Marked ${updatedIds.length} past appointment(s) as TBD: ${updatedIds.join(", ")}`
    );
  }

  return {
    updatedCount: updatedIds.length,
    updatedIds,
  };
};

export const syncPastAppointmentsToTbd = async (
  now: Date = new Date()
): Promise<LifecycleResult> => {
  const appointments = (await prisma.appointment.findMany({
    where: { deleted: false },
  })).map(toAppointment);

  return markPastAppointmentsAsTbd(appointments, now);
};

export const readAppointmentsWithLifecycle = async (
  now: Date = new Date()
): Promise<Appointment[]> => {
  const appointments = (await prisma.appointment.findMany()).map(toAppointment);
  await markPastAppointmentsAsTbd(appointments, now);
  return appointments;
};
