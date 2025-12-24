import { Request, Response } from "express";
import {
  Staff,
  StaffFinancialRecord,
  Attendance,
  ApiResponse,
} from "../types/staff";

// Temporary in-memory storage (replace with database later)
const staffMembers: Staff[] = [];
const staffFinancialRecords: StaffFinancialRecord[] = [];
const staffAttendanceRecords: Attendance[] = [];

let staffIdCounter = 0;

// --- CRUD Operations for Staff Members ---

export const createStaff = (
  req: Request,
  res: Response<ApiResponse<Staff>>
) => {
  try {
    console.log("[STAFF CREATE] Received request body:", req.body);
    const staffData: Staff = req.body;

    // Basic validation
    if (!staffData.name || !staffData.role || !staffData.email) {
      console.error("[STAFF CREATE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, role, email",
      });
    }

    console.log("[STAFF CREATE] Creating staff member:", staffData.name);

    const newStaff: Staff = {
      id: `staff_${Date.now()}_${staffIdCounter++}`,
      ...staffData,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    staffMembers.push(newStaff);
    console.log("[STAFF CREATE] Staff member saved. Total staff:", staffMembers.length);

    res.status(201).json({
      success: true,
      message: "Staff member added successfully",
      data: newStaff,
    });
  } catch (error) {
    console.error("[STAFF CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding staff member",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllStaff = (
  req: Request,
  res: Response<ApiResponse<Staff[]>>
) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const activeStaff = staffMembers.filter((staff) => !staff.deleted);
    const total = activeStaff.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const items = activeStaff.slice(start, end);

    res.json({
      success: true,
      message: "Staff members retrieved successfully",
      data: items,
      meta: { total, page: pageNum, limit: limitNum, totalPages },
    });
  } catch (error) {
    console.error("[STAFF GET_ALL] Error fetching staff members:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff members",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getStaffById = (
  req: Request,
  res: Response<ApiResponse<Staff | null>>
) => {
  try {
    const { id } = req.params;
    const staff = staffMembers.find((rec) => rec.id === id);

    if (!staff || staff.deleted) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.json({
      success: true,
      message: "Staff member retrieved successfully",
      data: staff,
    });
  } catch (error) {
    console.error("[STAFF GET_BY_ID] Error fetching staff member:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff member",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateStaff = (
  req: Request,
  res: Response<ApiResponse<Staff | null>>
) => {
  try {
    const { id } = req.params;
    const updates: Partial<Staff> = req.body;

    const staffIndex = staffMembers.findIndex((rec) => rec.id === id);
    if (staffIndex === -1 || staffMembers[staffIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    const updatedStaff: Staff = {
      ...staffMembers[staffIndex],
      ...updates,
      id: staffMembers[staffIndex].id, // Prevent ID change
      updatedAt: new Date(),
    };

    staffMembers[staffIndex] = updatedStaff;

    res.json({
      success: true,
      message: "Staff member updated successfully",
      data: updatedStaff,
    });
  } catch (error) {
    console.error("[STAFF UPDATE] Error updating staff member:", error);
    res.status(500).json({
      success: false,
      message: "Error updating staff member",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteStaff = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const staffIndex = staffMembers.findIndex((rec) => rec.id === id);

    if (staffIndex === -1 || staffMembers[staffIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // soft delete
    staffMembers[staffIndex] = {
      ...staffMembers[staffIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("[STAFF DELETE] Soft-deleted staff member:", staffMembers[staffIndex]);

    res.json({
      success: true,
      message: "Staff member soft-deleted successfully",
    });
  } catch (error) {
    console.error("[STAFF DELETE] Error deleting staff member:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting staff member",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

let staffFinancialRecordIdCounter = 0;

export const createStaffFinancialRecord = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord>>
) => {
  try {
    const recordData: StaffFinancialRecord = req.body;

    // Basic validation
    if (!recordData.staffId || !recordData.type || !recordData.amount || !recordData.date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: staffId, type, amount, date",
      });
    }
    
    const staffMember = staffMembers.find(s => s.id === recordData.staffId);
    if(!staffMember) {
        return res.status(404).json({
            success: false,
            message: "Staff member not found",
        });
    }

    const newRecord: StaffFinancialRecord = {
      ...recordData,
      id: `staff_fin_${Date.now()}_${staffFinancialRecordIdCounter++}`,
      staffName: staffMember.name,
      status: 'pending',
    };

    staffFinancialRecords.push(newRecord);

    res.status(201).json({
      success: true,
      message: "Staff financial record added successfully",
      data: newRecord,
    });
  } catch (error) {
    console.error("[STAFF CREATE_FINANCIAL_RECORD] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding staff financial record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// --- Staff-specific Endpoints (using mock data for now) ---

export const getStaffFinancialRecords = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord[]>>
) => {
  try {
    res.json({
      success: true,
      message: "Staff financial records retrieved successfully",
      data: staffFinancialRecords,
    });
  } catch (error) {
    console.error(
      "[STAFF FINANCIAL_RECORDS] Error fetching staff financial records:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Error fetching staff financial records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getStaffAttendance = (
  req: Request,
  res: Response<ApiResponse<Attendance[]>>
) => {
  try {
    // TODO: Replace with actual logic if needed
    const data: Attendance[] = [];
    res.json({
      success: true,
      message: "Staff attendance records retrieved successfully",
      data,
    });
  } catch (error) {
    console.error(
      "[STAFF ATTENDANCE] Error fetching staff attendance records:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Error fetching staff attendance records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};