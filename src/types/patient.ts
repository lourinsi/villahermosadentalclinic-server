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
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
