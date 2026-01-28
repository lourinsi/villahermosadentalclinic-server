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
