import express from "express";
import { createPayment, getPaymentsByAppointment, getPaymentsByPatient } from "../controllers/paymentController";

const router = express.Router();

// Create payment (generic)
router.post("/", createPayment);

// Payments for an appointment
router.get("/appointment/:id", getPaymentsByAppointment);

// Payments for a patient
router.get("/patient/:id", getPaymentsByPatient);

export default router;
