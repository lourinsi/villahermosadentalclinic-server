export interface FinanceRecord {
  id?: string;
  patientId?: string;
  type: "charge" | "payment" | string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
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
