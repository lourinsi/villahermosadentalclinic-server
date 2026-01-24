import { Router } from "express";
import {
  addPatient,
  addDependent,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  changePassword,
} from "../controllers/patientController";

const router = Router();

// POST - Add new patient
router.post("/", addPatient);

// POST - Add dependent patient
router.post("/dependent", addDependent);

// GET - Get all patients
router.get("/", getPatients);

// GET - Get patient by ID
router.get("/:id", getPatientById);

// PUT - Update patient by ID
router.put("/:id", updatePatient);

// POST - Change password
router.post("/:id/change-password", changePassword);

// DELETE - Soft delete patient by ID
router.delete("/:id", deletePatient);

export default router;
