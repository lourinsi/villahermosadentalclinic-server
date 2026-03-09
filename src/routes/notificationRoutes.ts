import express from "express";
import {
  getNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
  markAllAsRead,
} from "../controllers/notificationController";

const router = express.Router();

router.get("/", getNotifications);
router.post("/", addNotification);
router.put("/mark-all-read", markAllAsRead);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

export default router;
