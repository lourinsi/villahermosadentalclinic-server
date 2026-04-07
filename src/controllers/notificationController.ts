import { Request, Response } from "express";
import { Notification } from "../types/notification";
import { ApiResponse } from "../types/patient";
import { readData, writeData } from "../utils/storage";
import { updateOrCreateNotificationForAppointment } from "../utils/notifications";

const COLLECTION = "notifications";

export const getNotifications = (req: Request, res: Response<ApiResponse<Notification[]>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    
    console.log(`[getNotifications] Raw query object:`, req.query);
    console.log(`[getNotifications] Raw query string:`, req.url);

    const { userId, type, includeDeleted } = req.query as Record<string, string>;

    console.log(`[getNotifications] userId=${userId}, type=${type}, includeDeleted=${includeDeleted}`);
    console.log(`[getNotifications] includeDeleted type: ${typeof includeDeleted}, value: "${includeDeleted}"`);
    console.log(`[getNotifications] Total notifications in database: ${notifications.length}`);
    console.log(`[getNotifications] Deleted notifications count: ${notifications.filter(n => n.deleted).length}`);

    // Check if includeDeleted parameter is true (handle both string 'true' and boolean true)
    const shouldIncludeDeleted = includeDeleted === 'true' || includeDeleted === 'True' || includeDeleted === '1';
    console.log(`[getNotifications] shouldIncludeDeleted: ${shouldIncludeDeleted}`);

    let filtered = shouldIncludeDeleted ? notifications : notifications.filter(n => !n.deleted);

    console.log(`[getNotifications] After includeDeleted filter: ${filtered.length} notifications`);
    console.log(`[getNotifications] After filter - deleted count in filtered: ${filtered.filter(n => n.deleted).length}`);

    if (userId) {
      filtered = filtered.filter(n => n.userId === userId);
      console.log(`[getNotifications] After userId filter: ${filtered.length} notifications`);
    }

    if (type) {
      filtered = filtered.filter(n => n.type === type);
      console.log(`[getNotifications] After type filter: ${filtered.length} notifications`);
    }

    // Sort by latest date (updatedAt or createdAt) descending
    filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    console.log(`[getNotifications] Final result: ${filtered.length} notifications returned`);
    console.log(`[getNotifications] Final - deleted count in result: ${filtered.filter(n => n.deleted).length}`);

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
    console.log(`[deleteNotification] Attempting to delete notification with id: ${id}`);
    const index = notifications.findIndex(n => n.id === id);

    if (index === -1) {
      console.log(`[deleteNotification] Notification with id ${id} not found`);
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

    console.log(`[deleteNotification] Notification ${id} marked as deleted at ${notifications[index].deletedAt}`);

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

export const deleteAllNotifications = (req: Request, res: Response<ApiResponse<null>>) => {
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
      if (n.userId === userId && !n.deleted) {
        return { ...n, deleted: true, deletedAt: new Date().toISOString() };
      }
      return n;
    });

    writeData(COLLECTION, updatedNotifications);

    res.json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing notifications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const restoreNotification = (req: Request, res: Response<ApiResponse<Notification>>) => {
  try {
    const notifications = readData<Notification>(COLLECTION);
    const { id } = req.params;
    console.log(`[restoreNotification] Attempting to restore notification with id: ${id}`);
    const index = notifications.findIndex(n => n.id === id);

    if (index === -1) {
      console.log(`[restoreNotification] Notification with id ${id} not found`);
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (!notifications[index].deleted) {
      console.log(`[restoreNotification] Notification ${id} is not deleted`);
      return res.status(400).json({
        success: false,
        message: "Notification is not deleted",
      });
    }

    notifications[index] = {
      ...notifications[index],
      deleted: false,
      deletedAt: undefined,
    };

    console.log(`[restoreNotification] Notification ${id} restored successfully`);

    writeData(COLLECTION, notifications);

    res.json({
      success: true,
      message: "Notification restored successfully",
      data: notifications[index],
    });
  } catch (error) {
    console.error("Error restoring notification:", error);
    res.status(500).json({
      success: false,
      message: "Error restoring notification",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
