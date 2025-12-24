import { Router } from "express";
import {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  getStaffFinancialRecords,
  createStaffFinancialRecord,
  getStaffAttendance,
} from "../controllers/staffController";

const router = Router();

// POST - Add new staff member
router.post("/", createStaff);

// GET - Get all staff members
router.get("/", getAllStaff);

// GET - Get staff financial records - MORE SPECIFIC ROUTE FIRST
router.get("/financials", getStaffFinancialRecords);

// POST - Add new staff financial record
router.post("/financials", createStaffFinancialRecord);

// GET - Get staff attendance records - MORE SPECIFIC ROUTE FIRST
router.get("/attendance", getStaffAttendance);

// GET - Get staff member by ID - GENERAL ROUTE LAST
router.get("/:id", getStaffById);

// PUT - Update staff member
router.put("/:id", updateStaff);

// DELETE - Delete staff member
router.delete("/:id", deleteStaff);

export default router;