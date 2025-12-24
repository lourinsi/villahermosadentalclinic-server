import { Request, Response } from "express";
import { Appointment, ApiResponse } from "../types/appointment";

// Temporary in-memory storage (replace with database later)
const appointments: Appointment[] = [];
let appointmentIdCounter = 0;

export const addAppointment = (req: Request, res: Response<ApiResponse<Appointment>>) => {
  try {
    console.log("[APPOINTMENT CREATE] Received request body:", req.body);
    const appointmentData: Appointment = req.body;

    // Basic validation
    if (!appointmentData.patientId || !appointmentData.patientName || !appointmentData.date || !appointmentData.time) {
      console.error("[APPOINTMENT CREATE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: patientId, patientName, date, time",
      });
    }

    console.log("[APPOINTMENT CREATE] Creating appointment for patient:", appointmentData.patientName);

    // Create appointment object with ID and timestamps
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${appointmentIdCounter++}`,
      patientId: appointmentData.patientId,
      patientName: appointmentData.patientName,
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type || "",
      doctor: appointmentData.doctor || "",
      notes: appointmentData.notes || "",
      status: appointmentData.status || "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    console.log("[APPOINTMENT CREATE] New appointment object created:", newAppointment);
    appointments.push(newAppointment);
    console.log("[APPOINTMENT CREATE] Appointment saved. Total appointments:", appointments.length);

    res.status(201).json({
      success: true,
      message: "Appointment added successfully",
      data: newAppointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointments = (
  req: Request,
  res: Response<ApiResponse<Appointment[]>>
) => {
  try {
    // return only non-deleted appointments
    const active = appointments.filter(a => !a.deleted);
    res.json({
      success: true,
      message: "Appointments retrieved successfully",
      data: active,
    });
  } catch (error) {
    console.error("[APPOINTMENT GET] Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAppointmentById = (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const { id } = req.params;
    const appointment = appointments.find((apt) => apt.id === id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.json({
      success: true,
      message: "Appointment retrieved successfully",
      data: appointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT GET_BY_ID] Error fetching appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateAppointment = (
  req: Request,
  res: Response<ApiResponse<Appointment | null>>
) => {
  try {
    const { id } = req.params;
    const updates: Partial<Appointment> = req.body;

    const appointmentIndex = appointments.findIndex((apt) => apt.id === id);
    if (appointmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const updatedAppointment: Appointment = {
      ...appointments[appointmentIndex],
      ...updates,
      id: appointments[appointmentIndex].id, // Prevent ID change
      updatedAt: new Date(),
    };

    appointments[appointmentIndex] = updatedAppointment;

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    console.error("[APPOINTMENT UPDATE] Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteAppointment = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const appointmentIndex = appointments.findIndex((apt) => apt.id === id);

    if (appointmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // soft delete
    appointments[appointmentIndex] = {
      ...appointments[appointmentIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("[APPOINTMENT DELETE] Soft-deleted appointment:", appointments[appointmentIndex]);

    res.json({
      success: true,
      message: "Appointment soft-deleted successfully",
    });
  } catch (error) {
    console.error("[APPOINTMENT DELETE] Error deleting appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
