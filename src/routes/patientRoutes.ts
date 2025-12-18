import { Router } from "express";
import {
  addPatient,
  getPatients,
  getPatientById,
} from "../controllers/patientController";

const router = Router();

// POST - Add new patient
router.post("/", addPatient);

// GET - Get all patients
router.get("/", getPatients);

// GET - Get patient by ID
router.get("/:id", getPatientById);

export default router;
