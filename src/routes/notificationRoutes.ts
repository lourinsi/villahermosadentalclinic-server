import express from "express";
import {
  getNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
  markAllAsRead,
  deleteAllNotifications,
  restoreNotification,
} from "../controllers/notificationController";

const router = express.Router();

router.get("/", getNotifications);
router.post("/", addNotification);
router.put("/mark-all-read", markAllAsRead);
router.put("/:id", updateNotification);
router.put("/:id/restore", restoreNotification);
router.delete("/:id", deleteNotification);
router.delete("/", deleteAllNotifications);

export default router;
