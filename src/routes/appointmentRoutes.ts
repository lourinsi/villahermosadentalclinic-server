import { Router } from "express";
import {
  addAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  recordPayment,
  deleteAppointment,
} from "../controllers/appointmentController";

const router = Router();

// POST - Add new appointment
router.post("/", addAppointment);

// GET - Get all appointments
router.get("/", getAppointments);

// GET - Get appointment by ID
router.get("/:id", getAppointmentById);

// PUT - Update appointment
router.put("/:id", updateAppointment);

// POST - Record payment for appointment
router.post("/:id/pay", recordPayment);

// DELETE - Delete appointment
router.delete("/:id", deleteAppointment);

export default router;
