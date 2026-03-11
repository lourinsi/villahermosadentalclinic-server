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
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// POST - Add new patient (admin/doctor only)
router.post("/", addPatient);

// POST - Add dependent patient
router.post("/dependent", addDependent);

// GET - Get all patients
router.get("/", getPatients);

// GET - Get patient by ID
router.get("/:id", getPatientById);

// PUT - Update patient by ID (admin/doctor only)
router.put("/:id", requireAuth, requireRole(["admin", "doctor"]), updatePatient);

// POST - Change password
router.post("/:id/change-password", changePassword);

// DELETE - Soft delete patient by ID (admin/doctor only)
router.delete("/:id", requireAuth, requireRole(["admin", "doctor"]), deletePatient);

export default router;
