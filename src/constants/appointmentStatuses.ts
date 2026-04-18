/**
 * Appointment Status Constants
 * 
 * Standardized appointment status system - loaded from statuses.json
 * Maps old statuses to new unified statuses
 */

import fs from 'fs';
import path from 'path';

// Default statuses in case file doesn't exist
const DEFAULT_APPOINTMENT_STATUSES = [
  { key: 1, value: 'scheduled', label: 'Scheduled', description: 'Confirmed and scheduled' },
  { key: 2, value: 'pending', label: 'Pending', description: 'Awaiting confirmation' },
  { key: 3, value: 'reserved', label: 'Reserved', description: 'Tentatively reserved' },
  { key: 4, value: 'cancelled', label: 'Cancelled', description: 'Appointment cancelled' },
  { key: 5, value: 'completed', label: 'Completed', description: 'Appointment completed' },
  { key: 6, value: 'tbd', label: 'TBD', description: 'Past appointment awaiting completion status' },
];

// Load statuses from JSON file with fallback to defaults
let appointmentStatusList = DEFAULT_APPOINTMENT_STATUSES;
const statusesPath = path.join(__dirname, '../../..', 'villahermosa backend data', 'statuses.json');

try {
  const statusesData = JSON.parse(fs.readFileSync(statusesPath, 'utf-8'));
  if (statusesData.appointment && Array.isArray(statusesData.appointment)) {
    appointmentStatusList = statusesData.appointment;
    console.log('[STATUSES] Loaded from statuses.json');
  } else {
    console.warn('[STATUSES] statuses.json found but invalid format, using defaults');
  }
} catch (error) {
  console.warn(`[STATUSES] Could not load statuses.json (${error instanceof Error ? error.message : 'unknown error'}), using defaults`);
  console.warn(`[STATUSES] Expected file at: ${statusesPath}`);
}

// Numeric keys - Single source of truth for seeder and database
// IMPORTANT: These keys must NEVER change. If adding new statuses, use next available number.
export const APPOINTMENT_STATUS_KEYS = {
  SCHEDULED: 1,
  PENDING: 2,
  RESERVED: 3,
  CANCELLED: 4,
  COMPLETED: 5,
  TBD: 6,
} as const;

// Map numeric keys to string values for storage
export const APPOINTMENT_STATUS_VALUES: Record<number, string> = appointmentStatusList.reduce((acc: any, status: any) => {
  acc[status.key] = status.value || status.key;
  return acc;
}, {});

// Build APPOINTMENT_STATUSES object from JSON using value field
export const APPOINTMENT_STATUSES = appointmentStatusList.reduce((acc: any, status: any) => {
  const statusValue = status.value || status.key; // fallback to key if no value field
  acc[statusValue.toUpperCase()] = statusValue;
  return acc;
}, {}) as any;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];

/**
 * Status Descriptions for UI/Documentation - built from JSON using value field
 */
export const STATUS_DESCRIPTIONS: Record<string, string> = appointmentStatusList.reduce((acc: any, status: any) => {
  const statusValue = status.value || status.key; // fallback to key if no value field
  acc[statusValue] = status.description;
  return acc;
}, {});

/**
 * Legacy status mapping for migration
 * Maps old statuses to new standardized statuses
 */
export const LEGACY_STATUS_MAP: Record<string, string> = {
  // Old -> New mappings
  'confirmed': 'scheduled',
  'tentative': 'pending',
  'pending': 'pending',
  'reserved': 'reserved',
  'cancelled': 'cancelled',
  
  // Direct mappings (in case old data already uses new values)
  'scheduled': 'scheduled',
  'completed': 'completed',
  'tbd': 'tbd',
} as const;

/**
 * Get available status options for filtering/selection - directly from JSON
 * Uses the 'value' field for the status string (database representation)
 */
export const getStatusOptions = () => appointmentStatusList.map((status: any) => ({
  label: status.label,
  value: status.value || status.key, // use value field, fallback to key
  description: status.description,
}));

/**
 * Normalize status from legacy format to new format
 */
export const normalizeStatus = (status: string | undefined): string => {
  if (!status) return 'pending';
  const normalized = status.toLowerCase().trim();
  return LEGACY_STATUS_MAP[normalized] || 'pending';
};

/**
 * Export the full appointment status list from JSON for frontend/API use
 */
export const getAppointmentStatusesFromJSON = () => appointmentStatusList;