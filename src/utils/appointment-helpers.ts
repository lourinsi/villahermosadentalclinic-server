import { Appointment } from "../types/appointment";

/**
 * Checks for appointment conflicts for a specific doctor
 */
export const hasConflict = (
  appointments: Appointment[],
  newDate: string,
  newTime: string,
  newDuration: number,
  doctor: string,
  excludeId?: string
): boolean => {
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const newStart = timeToMinutes(newTime);
  const duration = Number(newDuration) || 60;
  const newEnd = newStart + duration;

  return appointments.some((apt) => {
    if (
      apt.deleted || 
      apt.id === excludeId || 
      apt.date !== newDate || 
      apt.status === "cancelled" || 
      apt.paymentStatus === "unpaid" ||
      apt.status === "pending" // Pending appointments in cart don't block others until paid/scheduled
    ) {
      return false;
    }

    // If a specific doctor is provided, only check conflicts for that doctor
    if (doctor && apt.doctor && doctor !== apt.doctor) {
      return false;
    }

    const aptStart = timeToMinutes(apt.time);
    const aptDuration = Number(apt.duration) || 60;
    const aptEnd = aptStart + aptDuration;

    // Overlap condition: (newStart < aptEnd) && (newEnd > aptStart)
    return newStart < aptEnd && newEnd > aptStart;
  });
};
