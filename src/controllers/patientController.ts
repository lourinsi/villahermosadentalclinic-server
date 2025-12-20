import { Request, Response } from "express";
import { Patient, ApiResponse } from "../types/patient";

// Temporary in-memory storage (replace with database later)
const patients: Patient[] = [];

export const addPatient = (req: Request, res: Response<ApiResponse<Patient>>) => {
  try {
    console.log("[PATIENT CREATE] Received request body:", req.body);
    const patientData: Patient = req.body;

    // Basic validation - only require firstName and lastName
    if (!patientData.firstName) {
      console.error("[PATIENT CREATE] Missing firstName");
      return res.status(400).json({
        success: false,
        message: "Missing required field: firstName",
      });
    }

    console.log("[PATIENT CREATE] Creating patient with firstName:", patientData.firstName, "lastName:", patientData.lastName);

    // Create patient object with ID and timestamps
    const newPatient: Patient = {
      id: `patient_${Date.now()}`,
      firstName: patientData.firstName || "",
      lastName: patientData.lastName || "",
      email: patientData.email || "",
      phone: patientData.phone || "",
      dateOfBirth: patientData.dateOfBirth || "",
      address: patientData.address || "",
      city: patientData.city || "",
      zipCode: patientData.zipCode || "",
      insurance: patientData.insurance || "",
      emergencyContact: patientData.emergencyContact || "",
      emergencyPhone: patientData.emergencyPhone || "",
      medicalHistory: patientData.medicalHistory || "",
      allergies: patientData.allergies || "",
      notes: patientData.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("[PATIENT CREATE] New patient object created:", newPatient);
    patients.push(newPatient);
    console.log("[PATIENT CREATE] Patient saved. Total patients:", patients.length);

    res.status(201).json({
      success: true,
      message: "Patient added successfully",
      data: newPatient,
    });
  } catch (error) {
    console.error("[PATIENT CREATE] ERROR:", error);
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
