import { NotificationType } from '../shared/notificationStatuses';

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  link?: string;
  isLog?: boolean; // Marked as true when this is a historical log entry (read-only)
  metadata?: {
    appointmentId?: string;
    currentStatus?: string;
    patientName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    doctor?: string;
    amount?: number;
    paymentDate?: string;
    paymentId?: string;
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
