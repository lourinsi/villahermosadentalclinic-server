import { Router, Request, Response } from "express";
import { APPOINTMENT_STATUSES } from "../shared/appointmentStatuses";
import { PAYMENT_STATUSES } from "../shared/paymentStatuses";
import {
  CART_APPOINTMENT_STATUS,
  CART_APPOINTMENT_STATUS_LABEL,
  normalizeStatus,
} from "../constants/appointmentStatuses";
import { prisma } from "../lib/prisma";

const router = Router();

const getDefaultBgColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    scheduled: "bg-emerald-100",
    [CART_APPOINTMENT_STATUS]: "bg-orange-100",
    reserved: "bg-amber-100",
    cancelled: "bg-red-100",
    completed: "bg-blue-100",
    tbd: "bg-red-100",
  };
  return colorMap[status] || "bg-gray-100";
};

const getDefaultTextColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    scheduled: "text-emerald-700",
    [CART_APPOINTMENT_STATUS]: "text-orange-700",
    reserved: "text-amber-700",
    cancelled: "text-red-700",
    completed: "text-blue-700",
    tbd: "text-red-700",
  };
  return colorMap[status] || "text-gray-700";
};

router.get("/appointments", async (req: Request, res: Response) => {
  try {
    const config = await prisma.statusConfig.findUnique({ where: { key: "appointment" } });
    const rawStatuses = Array.isArray(config?.value) ? config.value : APPOINTMENT_STATUSES;
    const appointmentStatusesByValue = new Map<string, any>();

    for (const status of rawStatuses as any[]) {
      const value = normalizeStatus(status.value);
      const isCartStatus = value === CART_APPOINTMENT_STATUS;
      if (appointmentStatusesByValue.has(value)) continue;

      appointmentStatusesByValue.set(value, {
        key: status.key,
        value,
        label: isCartStatus ? CART_APPOINTMENT_STATUS_LABEL : status.label,
        description: isCartStatus
          ? "In the patient's appointment cart awaiting checkout"
          : status.description,
        bgColor: isCartStatus ? getDefaultBgColor(value) : status.bgColor || getDefaultBgColor(value),
        textColor: isCartStatus ? getDefaultTextColor(value) : status.textColor || getDefaultTextColor(value),
      });
    }

    const appointmentStatuses = Array.from(appointmentStatusesByValue.values());

    res.json({
      success: true,
      data: appointmentStatuses,
      message: "Appointment statuses retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching appointment statuses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/payments", (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: PAYMENT_STATUSES,
      message: "Payment statuses retrieved successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
