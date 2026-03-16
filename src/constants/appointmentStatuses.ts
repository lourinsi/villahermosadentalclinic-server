/**
 * Appointment Status Constants
 * 
 * Standardized appointment status system
 * Maps old statuses to new unified statuses
 */

export const APPOINTMENT_STATUSES = {
  SCHEDULED: 'scheduled',   // Confirmed and scheduled (was "confirmed")
  PENDING: 'pending',       // Awaiting confirmation (was "tentative", "pending")
  RESERVED: 'reserved',     // Tentatively held/reserved (was "reserved")
  CANCELLED: 'cancelled',   // Appointment cancelled (was "cancelled")
} as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];

/**
 * Status Descriptions for UI/Documentation
 */
export const STATUS_DESCRIPTIONS: Record<AppointmentStatus, string> = {
  [APPOINTMENT_STATUSES.SCHEDULED]: 'Appointment is confirmed and scheduled',
  [APPOINTMENT_STATUSES.PENDING]: 'Awaiting confirmation from patient or clinic',
  [APPOINTMENT_STATUSES.RESERVED]: 'Time slot is tentatively reserved',
  [APPOINTMENT_STATUSES.CANCELLED]: 'Appointment has been cancelled',
} as const;

/**
 * Legacy status mapping for migration
 * Maps old statuses to new standardized statuses
 */
export const LEGACY_STATUS_MAP: Record<string, AppointmentStatus> = {
  // Old -> New mappings
  'confirmed': APPOINTMENT_STATUSES.SCHEDULED,
  'tentative': APPOINTMENT_STATUSES.PENDING,
  'pending': APPOINTMENT_STATUSES.PENDING,
  'reserved': APPOINTMENT_STATUSES.RESERVED,
  'cancelled': APPOINTMENT_STATUSES.CANCELLED,
  
  // Direct mappings (in case old data already uses new values)
  'scheduled': APPOINTMENT_STATUSES.SCHEDULED,
} as const;

/**
 * Get available status options for filtering/selection
 */
export const getStatusOptions = () => Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => ({
  label: key.charAt(0) + key.slice(1).toLowerCase(),
  value: value,
  description: STATUS_DESCRIPTIONS[value],
}));

/**
 * Normalize status from legacy format to new format
 */
export const normalizeStatus = (status: string): AppointmentStatus => {
  const normalized = status?.toLowerCase().trim();
  return LEGACY_STATUS_MAP[normalized] || APPOINTMENT_STATUSES.PENDING;
};