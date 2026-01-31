import { Notification, NotificationType } from "../types/notification";
import { readData, writeData } from "./storage";

const COLLECTION = "notifications";

export const createNotification = (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
): Notification => {
  const notifications = readData<Notification>(COLLECTION);
  
  const newNotification: Notification = {
    id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    message,
    type,
    metadata,
    createdAt: new Date().toISOString(),
    isRead: false,
    deleted: false,
  };

  notifications.push(newNotification);
  writeData(COLLECTION, notifications);
  
  return newNotification;
};

/**
 * Updates an existing notification for a specific appointment, or creates a new one if none exists.
 * This is for a single user.
 */
export const updateOrCreateNotificationForAppointment = (
  userId: string,
  appointmentId: string,
  details: {
    title:string;
    message: string;
    type: NotificationType;
    metadata: Notification["metadata"];
  }
) => {
  const notifications = readData<Notification>(COLLECTION);

  const existingNotificationIndex = notifications.findIndex(n => n.userId === userId && n.metadata?.appointmentId === appointmentId);

  if (existingNotificationIndex !== -1) {
    // Update existing notification
    notifications[existingNotificationIndex] = {
      ...notifications[existingNotificationIndex],
      title: details.title,
      message: details.message,
      type: details.type,
      metadata: details.metadata,
      isRead: false, // Mark as unread on update
      updatedAt: new Date().toISOString(),
    };
    writeData(COLLECTION, notifications);
  } else {
    // Create new notification
    const newNotification: Notification = {
      id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId,
      title: details.title,
      message: details.message,
      type: details.type,
      metadata: details.metadata,
      createdAt: new Date().toISOString(),
      isRead: false,
      deleted: false,
    };
    notifications.push(newNotification);
    writeData(COLLECTION, notifications);
  }
};

export const notifyAdmin = (
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Notification["metadata"]
) => {
  const staff = readData<any>("staff");
  const admin = staff.find((s: any) => s.role?.toLowerCase().includes("manager") || s.role?.toLowerCase().includes("admin")) || staff[0];
  
  if (admin) {
    return createNotification(admin.id, title, message, type, metadata);
  }
};
