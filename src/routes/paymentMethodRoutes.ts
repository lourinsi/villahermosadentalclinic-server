import { Router } from "express";
import { getPaymentMethods, createPaymentMethod } from "../controllers/paymentMethodController";

const router = Router();

router.get("/", getPaymentMethods);
router.post("/", createPaymentMethod);

export default router;
