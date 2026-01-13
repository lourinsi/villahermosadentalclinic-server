export interface Payment {
  id: string;
  appointmentId: string;
  patientId?: string;
  amount: number;
  method: string;
  date: string;
  transactionId: string;
  notes?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deleted?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}
