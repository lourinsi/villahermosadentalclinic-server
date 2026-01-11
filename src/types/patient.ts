export interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  zipCode: string;
  insurance?: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalHistory?: string;
  allergies?: string;
  notes?: string;
  dentalCharts?: { date: string; data: string; isEmpty: boolean }[];
  status?: "active" | "overdue" | "inactive" | string;
  lastVisit?: string;
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
