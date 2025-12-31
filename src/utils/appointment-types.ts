export const APPOINTMENT_TYPES = [
  "Routine Cleaning",
  "Checkup",
  "Filling",
  "Root Canal",
  "Extraction",
  "Whitening",
  "Other",
];

export const getAppointmentTypeName = (typeIndex: number, customType?: string): string => {
  if (typeIndex === APPOINTMENT_TYPES.length - 1) {
    return customType || "Other";
  }
  return APPOINTMENT_TYPES[typeIndex] || "Unknown";
};
