export interface Appointment {
  id?: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: number; // Index referring to APPOINTMENT_TYPES array
  customType?: string; // Used when type is 'Other'
  price?: number;
  doctor: string;
  duration?: number; // in minutes
  notes?: string;
  status?: "scheduled" | "confirmed" | "pending" | "tentative" | "completed" | "cancelled";
  createdAt?: Date;
  updatedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  meta?: any;
  data?: T;
  error?: string;
}
