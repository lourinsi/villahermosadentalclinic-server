export interface Appointment {
  id?: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: string; // e.g., "Cleaning", "Checkup", "Filling"
  doctor: string;
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
