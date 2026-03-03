export type NotificationType = 'appointment' | 'payment' | 'message' | 'system';

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  link?: string;
  metadata?: {
    appointmentId?: string;
    currentStatus?: string;
    patientName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  changedFields?: { [key: string]: any };
    isRequest?: boolean;
    isDoctorView?: boolean;
    isAdminView?: boolean;
    isPatientView?: boolean;
  };
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
}
