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

const router = Router();

// POST - Public booking (no auth required)
router.post("/public-book", bookPublicAppointment);

// GET - Appointment logs
router.get("/:id/logs", fetchAppointmentLogs);

// GET - Payment logs
router.get("/:id/payments", fetchPaymentLogs);

// POST - Add new appointment
router.post("/", addAppointment);

// GET - Get all appointments
router.get("/", getAppointments);

// GET - Get appointment by ID
router.get("/:id", getAppointmentById);

// PUT - Update appointment
router.put("/:id", updateAppointment);

// DELETE - Delete appointment
router.delete("/:id", deleteAppointment);

export default router;
