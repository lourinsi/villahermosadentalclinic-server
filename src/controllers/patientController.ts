import { Request, Response } from "express";
import { Patient, ApiResponse } from "../types/patient";

// Temporary in-memory storage (replace with database later)
const patients: Patient[] = [];

export const addPatient = (req: Request, res: Response<ApiResponse<Patient>>) => {
  try {
    const patientData: Patient = req.body;

    // Basic validation
    if (
      !patientData.firstName ||
      !patientData.lastName ||
      !patientData.email ||
      !patientData.phone
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: firstName, lastName, email, phone",
      });
    }

    // Create patient object with ID and timestamps
    const newPatient: Patient = {
      id: `patient_${Date.now()}`,
      ...patientData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    patients.push(newPatient);

    res.status(201).json({
      success: true,
      message: "Patient added successfully",
      data: newPatient,
    });
  } catch (error) {
    console.error("Error adding patient:", error);
    res.status(500).json({
      success: false,
      message: "Error adding patient",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPatients = (
  req: Request,
  res: Response<ApiResponse<Patient[]>>
) => {
  try {
    res.json({
      success: true,
      message: "Patients retrieved successfully",
      data: patients,
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching patients",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPatientById = (
  req: Request,
  res: Response<ApiResponse<Patient | null>>
) => {
  try {
    const { id } = req.params;
    const patient = patients.find((p) => p.id === id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      message: "Patient retrieved successfully",
      data: patient,
    });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching patient",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
