import { Request, Response } from "express";
import { Notification } from "../types/notification";
import { ApiResponse } from "../types/patient";
import { readData, writeData } from "../utils/storage";
import { updateOrCreateNotificationForAppointment } from "../utils/notifications";

const COLLECTION = "notifications";

export const getNotifications = (req: Request, res: Response<ApiResponse<Notification[]>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const { userId, type } = req.query as Record<string, string>;

    let filtered = notifications.filter(n => !n.deleted);

    if (userId) {
      filtered = filtered.filter(n => n.userId === userId);
    }

    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }

    // Sort by latest date (updatedAt or createdAt) descending
    filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json({
      success: true,
      message: "Notifications retrieved successfully",
      data: filtered,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const addNotification = (req: Request, res: Response<ApiResponse<Notification>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const notificationData: Notification = req.body;

    if (!notificationData.userId || !notificationData.title || !notificationData.message || !notificationData.type) {
      console.error("[NOTIFICATION CREATE] Missing required fields:", {
        userId: !!notificationData.userId,
        title: !!notificationData.title,
        message: !!notificationData.message,
        type: !!notificationData.type
      });
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, title, message, and type are required",
      });
    }

    // Special handling for appointment notifications to prevent duplicates
    if (notificationData.type === "appointment" && notificationData.metadata?.appointmentId) {
      updateOrCreateNotificationForAppointment(
        notificationData.userId,
        notificationData.metadata.appointmentId,
        {
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          metadata: notificationData.metadata
        }
      );

      // We need to return the updated/created notification. 
      // Since updateOrCreateNotificationForAppointment doesn't return it easily without re-reading,
      // and it handles its own writeData, we just re-read to find it.
      const updatedNotifications = readData<Notification>(COLLECTION);
      const found = updatedNotifications.find(n => 
        n.userId === notificationData.userId && 
        n.metadata?.appointmentId === notificationData.metadata?.appointmentId
      );

      return res.status(201).json({
        success: true,
        message: "Notification processed successfully",
        data: found,
      });
    }

    const newNotification: Notification = {
      ...notificationData,
      id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: notificationData.createdAt || new Date().toISOString(),
      isRead: notificationData.isRead || false,
      deleted: false,
    };

    notifications.push(newNotification);
    writeData(COLLECTION, notifications);

    res.status(201).json({
      success: true,
      message: "Notification added successfully",
      data: newNotification,
    });
  } catch (error) {
    console.error("Error adding notification:", error);
    res.status(500).json({
      success: false,
      message: "Error adding notification",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateNotification = (req: Request, res: Response<ApiResponse<Notification>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const { id } = req.params;
    const index = notifications.findIndex(n => n.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const updates = req.body;
    const isOnlyMarkingRead = Object.keys(updates).length === 1 && updates.isRead !== undefined;

    notifications[index] = {
      ...notifications[index],
      ...updates,
      // If updating more than just isRead, mark as unread AND update updatedAt
      isRead: isOnlyMarkingRead ? updates.isRead : false,
      updatedAt: isOnlyMarkingRead ? (notifications[index].updatedAt || notifications[index].createdAt) : new Date().toISOString(),
    };

    writeData(COLLECTION, notifications);

    res.json({
      success: true,
      message: "Notification updated successfully",
      data: notifications[index],
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error updating notification",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteNotification = (req: Request, res: Response<ApiResponse<null>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const { id } = req.params;
    const index = notifications.findIndex(n => n.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notifications[index] = {
      ...notifications[index],
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    writeData(COLLECTION, notifications);

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markAllAsRead = (req: Request, res: Response<ApiResponse<null>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const { userId } = req.query as Record<string, string>;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const updatedNotifications = notifications.map(n => {
      if (n.userId === userId && !n.isRead && !n.deleted) {
        return { ...n, isRead: true };
      }
      return n;
    });

    writeData(COLLECTION, updatedNotifications);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all as read",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
