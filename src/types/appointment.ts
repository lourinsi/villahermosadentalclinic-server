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
  paymentStatus?: "paid" | "unpaid" | "overdue" | "half-paid" | "over-paid";
  balance?: number;
  totalPaid?: number;
  // Deprecated: transactions are now stored in payments collection. Keep for backward compat only.
  transactions?: {
    id: string;
    amount: number;
    method?: string;
    date?: string;
    transactionId?: string;
    notes?: string;
    status?: string;
  }[];
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
