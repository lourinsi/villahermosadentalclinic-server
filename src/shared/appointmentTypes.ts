export const getAppointmentTypeName = (typeIndex: number, customType?: string): string => {
  // Type 6 (index) is always "Other" type, use customType if available
  if (typeIndex === 6) {
    return customType || "Other";
  }
  // For types 0-5, return the standard type name
  const standardTypes = [
    "Routine Cleaning",
    "Checkup",
    "Filling",
    "Root Canal",
    "Extraction",
    "Whitening",
  ];
  return standardTypes[typeIndex] || "Unknown";
};