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
    isRequest?: boolean;
  };
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
}
