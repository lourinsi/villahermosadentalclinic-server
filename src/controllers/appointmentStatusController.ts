import { Request, Response } from "express";
import { ApiResponse } from "../types/patient";
import { APPOINTMENT_STATUSES, STATUS_DESCRIPTIONS, getStatusOptions } from "../constants/appointmentStatuses";

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];

export const getAppointmentStatuses = (
  req: Request,
  res: Response<ApiResponse<any>>
) => {
  try {
    const statuses = getStatusOptions();
    
    res.status(200).json({
      success: true,
      message: "Appointment statuses retrieved successfully",
      data: statuses,
    });
  } catch (error) {
    console.error("[GET APPOINTMENT STATUSES] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getStatusDescription = (
  req: Request,
  res: Response<ApiResponse<string>>
) => {
  try {
    const { status } = req.params;
    const description = STATUS_DESCRIPTIONS[status as AppointmentStatus];
    
    if (!description) {
      return res.status(404).json({
        success: false,
        message: "Status not found",
      });
    }

    res.status(200).json({
      success: true,
      data: description,
      message: "Status description retrieved successfully",
    });
  } catch (error) {
    console.error("[GET STATUS DESCRIPTION] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch status description",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};