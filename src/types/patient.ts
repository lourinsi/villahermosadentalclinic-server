export interface Patient {
  id?: string;
  name: string;
  email: string;
  phone: string;
  alternateEmail?: string;
  alternatePhone?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  insurance?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalHistory?: string;
  allergies?: string;
  notes?: string;
  profilePicture?: string;
  parentId?: string;
  isPrimary?: boolean;
  relationship?: string;
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
