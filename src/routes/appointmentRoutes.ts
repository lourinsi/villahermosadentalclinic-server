import { Router } from "express";
import {
  addAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  bookPublicAppointment,
  fetchAppointmentLogs,
  fetchPaymentLogs,
} from "../controllers/appointmentController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

// POST - Public booking (no auth required)
router.post("/public-book", bookPublicAppointment);

// GET - Appointment logs
router.get("/:id/logs", requireAuth, fetchAppointmentLogs);

// GET - Payment logs
router.get("/:id/payments", requireAuth, fetchPaymentLogs);

// POST - Add new appointment
router.post("/", requireAuth, addAppointment);

// GET - Get all appointments
router.get("/", requireAuth, getAppointments);

// GET - Get appointment by ID
router.get("/:id", requireAuth, getAppointmentById);

// PUT - Update appointment
router.put("/:id", requireAuth, updateAppointment);

// DELETE - Delete appointment
router.delete("/:id", requireAuth, deleteAppointment);

export default router;
