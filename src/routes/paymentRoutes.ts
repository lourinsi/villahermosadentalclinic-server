import express from "express";
import { createPayment, getPaymentsByAppointment, getPaymentsByPatient, updatePayment, deletePayment } from "../controllers/paymentController";

const router = express.Router();

// Debug middleware for payment routes
router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[PAYMENT ROUTE] ${req.method} ${req.path}`);
  next();
});

// Payments for an appointment - must come before /:id routes
router.get("/appointment/:id", getPaymentsByAppointment);

// Payments for a patient - must come before /:id routes
router.get("/patient/:id", getPaymentsByPatient);

// Create payment (generic)
router.post("/", createPayment);

// Update payment
router.put("/:id", updatePayment);

// Delete payment
router.delete("/:id", deletePayment);

export default router;
