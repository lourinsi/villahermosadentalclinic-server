import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Patient, ApiResponse } from "../types/patient";
import { Appointment } from "../types/appointment";
import { readData, writeData } from "../utils/storage";

const COLLECTION = "patients";
const APPOINTMENT_COLLECTION = "appointments";

export const addPatient = async (req: Request, res: Response<ApiResponse<Patient>>) => {
  try {
    const patients = readData<Patient>(COLLECTION);
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

    // Use password from request body if it exists (like from seeder), otherwise create a new default password hash.
    const passwordHash = patientData.password
      ? patientData.password
      : await bcrypt.hash("villahermosa123", 10);

    const newPatientId = `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const isPrimary = patientData.isPrimary !== undefined ? patientData.isPrimary : (patientData.parentId ? false : true);

    // Create patient object with ID and timestamps
    const newPatient: Patient = {
      id: newPatientId,
      name: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
      firstName: patientData.firstName || "",
      lastName: patientData.lastName || "",
      email: patientData.email || "",
      phone: patientData.phone || "",
      password: passwordHash,
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
      parentId: patientData.parentId || (isPrimary ? newPatientId : undefined),
      isPrimary: isPrimary,
      dentalCharts: patientData.dentalCharts || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    console.log("[PATIENT CREATE] New patient object created:", newPatient);
    patients.push(newPatient);
    writeData(COLLECTION, patients);
    console.log("[PATIENT CREATE] Patient saved. Total patients:", patients.length);

    const { password, ...patientForResponse } = newPatient;

    res.status(201).json({
      success: true,
      message: "Patient added successfully",
      data: patientForResponse,
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

export const addDependent = async (req: Request, res: Response<ApiResponse<Patient>>) => {
  try {
    const patients = readData<Patient>(COLLECTION);
    const { parentId, firstName, lastName, relationship, dateOfBirth, medicalHistory, allergies } = req.body;

    if (!parentId || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: parentId, firstName, lastName",
      });
    }

    const parent = patients.find(p => p.id === parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent patient not found",
      });
    }

    const newPatient: Patient = {
      id: `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email: parent.email,
      phone: parent.phone,
      parentId,
      isPrimary: false,
      relationship: relationship || "Family Member",
      dateOfBirth: dateOfBirth || "",
      address: parent.address || "",
      city: parent.city || "",
      zipCode: parent.zipCode || "",
      insurance: parent.insurance || "",
      medicalHistory: medicalHistory || "",
      allergies: allergies || "",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    patients.push(newPatient);
    writeData(COLLECTION, patients);

    res.status(201).json({
      success: true,
      message: "Dependent patient added successfully",
      data: newPatient,
    });
  } catch (error) {
    console.error("[ADD DEPENDENT] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding dependent",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPatients = (
  req: Request,
  res: Response<ApiResponse<Patient[]>>
) => {
  try {
    const patients = readData<Patient>(COLLECTION);
    // server-side filtering + pagination
    const { page = "1", limit = "10", search = "", status = "all", parentId = "", doctor = "" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    // only return non-deleted patients
    let active = patients.filter(p => !p.deleted);

    // filter by doctor if provided (only if not searching, or we can make search global)
    if (doctor && !search) {
      const appointments = readData<Appointment>(APPOINTMENT_COLLECTION);
      const doctorLower = doctor.toLowerCase();
      const doctorPatientIds = new Set(
        appointments
          .filter(a => a.doctor.toLowerCase() === doctorLower && !a.deleted)
          .map(a => a.patientId)
      );
      active = active.filter(p => doctorPatientIds.has(p.id || ""));
    }

    // filter by parentId if provided
    if (parentId) {
      active = active.filter(p => p.parentId === parentId);
    }

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
    const items = active.slice(start, end).map(p => {
      const { password, ...patientForResponse } = p;
      return patientForResponse;
    });

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
    const patients = readData<Patient>(COLLECTION);
    const { id } = req.params;
    const patient = patients.find((p) => p.id === id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const { password, ...patientForResponse } = patient;

    res.json({
      success: true,
      message: "Patient retrieved successfully",
      data: patientForResponse,
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
    const patients = readData<Patient>(COLLECTION);
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

    // To prevent accidental password removal, we delete the password field from the request body.
    // Password updates should be handled by a dedicated endpoint.
    delete req.body.password;

    const updatedPatient: Patient = {
      ...patients[patientIndex],
      ...req.body,
      updatedAt: new Date(),
    };

    console.log("[PATIENT UPDATE] Updated patient data:", updatedPatient);
    patients[patientIndex] = updatedPatient;
    writeData(COLLECTION, patients);

    const { password, ...patientForResponse } = updatedPatient;

    res.json({
      success: true,
      message: "Patient updated successfully",
      data: patientForResponse,
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
    const patients = readData<Patient>(COLLECTION);
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
    writeData(COLLECTION, patients);

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

export const changePassword = async (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const patients = readData<Patient>(COLLECTION);
    const patientIndex = patients.findIndex((p) => p.id === id);

    if (patientIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const patient = patients[patientIndex];

    // Verify current password
    if (!patient.password) {
        return res.status(400).json({
            success: false,
            message: "Patient does not have a password set.",
        });
    }

    const isMatch = await bcrypt.compare(currentPassword, patient.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update patient
    patients[patientIndex] = {
      ...patient,
      password: hashedPassword,
      updatedAt: new Date(),
    };

    writeData(COLLECTION, patients);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("[PATIENT PASSWORD] Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
