import { Request, Response } from "express";
import { Notification } from "../types/notification";
import { ApiResponse } from "../types/patient";
import { readData, writeData } from "../utils/storage";

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

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

    notifications[index] = {
      ...notifications[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
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
        return { ...n, isRead: true, updatedAt: new Date().toISOString() };
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
