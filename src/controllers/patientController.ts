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
      status: patientData.status || "active",
      emergencyContact: patientData.emergencyContact || "",
      emergencyPhone: patientData.emergencyPhone || "",
      medicalHistory: patientData.medicalHistory || "",
      allergies: patientData.allergies || "",
      notes: patientData.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
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
    // server-side filtering + pagination
    const { page = "1", limit = "10", search = "", status = "all" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    // only return non-deleted patients
    let active = patients.filter(p => !p.deleted);

    // simple search across firstName, lastName, email, phone
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      active = active.filter(p => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        return (
          full.includes(q) ||
          (p.email || "").toLowerCase().includes(q) ||
          (p.phone || "").toLowerCase().includes(q)
        );
      });
    }

    // filter by status (active, overdue, inactive, all)
    if (status && status !== "all") {
      active = active.filter(p => p.status === status);
    }

    const total = active.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const items = active.slice(start, end);

    res.json({
      success: true,
      message: "Patients retrieved successfully",
      data: items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
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

export const updatePatient = (
  req: Request,
  res: Response<ApiResponse<Patient | null>>
) => {
  try {
    const { id } = req.params;
    console.log("[PATIENT UPDATE] Received update request for patient ID:", id);
    console.log("[PATIENT UPDATE] Update data:", req.body);

    const patientIndex = patients.findIndex((p) => p.id === id);

    if (patientIndex === -1) {
      console.error("[PATIENT UPDATE] Patient not found:", id);
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const updatedPatient: Patient = {
      ...patients[patientIndex],
      ...req.body,
      updatedAt: new Date(),
    };

    console.log("[PATIENT UPDATE] Updated patient data:", updatedPatient);
    patients[patientIndex] = updatedPatient;

    res.json({
      success: true,
      message: "Patient updated successfully",
      data: updatedPatient,
    });
  } catch (error) {
    console.error("[PATIENT UPDATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error updating patient",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deletePatient = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const patientIndex = patients.findIndex((p) => p.id === id);

    if (patientIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // soft delete
    patients[patientIndex] = {
      ...patients[patientIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      message: "Patient deleted (soft) successfully",
    });
  } catch (error) {
    console.error("[PATIENT DELETE] Error deleting patient:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting patient",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
