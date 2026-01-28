import { Request, Response } from "express";
import {
  Staff,
  StaffFinancialRecord,
  Attendance as BaseAttendance,
  ApiResponse,
} from "../types/staff";
import { readData, writeData } from "../utils/storage";
import { createNotification, notifyAdmin } from "../utils/notifications";

interface Attendance extends BaseAttendance {
  id: string;
  date: string;
  status: string;
}

const STAFF_COLLECTION = "staff";
const FINANCIAL_COLLECTION = "staff_financial_records";
const ATTENDANCE_COLLECTION = "staff_attendance";

// --- CRUD Operations for Staff Members ---

export const createStaff = (
  req: Request,
  res: Response<ApiResponse<Staff>>
) => {
  try {
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
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
      id: `staff_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ...staffData,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    staffMembers.push(newStaff);
    writeData(STAFF_COLLECTION, staffMembers);
    console.log("[STAFF CREATE] Staff member saved. Total staff:", staffMembers.length);

    // Notify Admin
    notifyAdmin(
      "New Staff Member Added",
      `${newStaff.name} has been added to the team as ${newStaff.role}.`,
      "system"
    );

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
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
    const { page = "1", limit = "20", role } = req.query as Record<
      string,
      string
    >;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    let activeStaff = staffMembers.filter((staff) => !staff.deleted);

    if (role) {
      const rolesToFilter = role.split(',').map(r => r.trim().toLowerCase());
      activeStaff = activeStaff.filter(staff => rolesToFilter.includes(staff.role.toLowerCase()));
    }

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
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
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
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
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
    writeData(STAFF_COLLECTION, staffMembers);

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
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
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
    writeData(STAFF_COLLECTION, staffMembers);

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

export const createStaffFinancialRecord = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord>>
) => {
  try {
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
    const staffFinancialRecords = readData<StaffFinancialRecord>(FINANCIAL_COLLECTION);
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
      id: `staff_fin_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      staffName: staffMember.name,
      status: 'pending',
    };

    staffFinancialRecords.push(newRecord);
    writeData(FINANCIAL_COLLECTION, staffFinancialRecords);

    // Notify Staff Member
    createNotification(
      newRecord.staffId,
      "New Financial Record",
      `A new ${newRecord.type} record for ₱${newRecord.amount.toLocaleString()} has been created.`,
      "payment"
    );

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

// --- Staff-specific Endpoints ---

export const getStaffFinancialRecords = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord[]>>
) => {
  try {
    const staffFinancialRecords = readData<StaffFinancialRecord>(FINANCIAL_COLLECTION);
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

export const updateStaffFinancialRecord = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord>>
) => {
  try {
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
    const staffFinancialRecords = readData<StaffFinancialRecord>(FINANCIAL_COLLECTION);
    const { id } = req.params;
    const updates: Partial<StaffFinancialRecord> = req.body;

    const recordIndex = staffFinancialRecords.findIndex((rec) => rec.id === id);
    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Staff financial record not found",
      });
    }

    let staffInfoUpdate: Partial<StaffFinancialRecord> = {};
    if (
      updates.staffId &&
      updates.staffId !== staffFinancialRecords[recordIndex].staffId
    ) {
      const staffMember = staffMembers.find((s) => s.id === updates.staffId);
      if (!staffMember) {
        return res.status(404).json({
          success: false,
          message: "Staff member not found",
        });
      }
      staffInfoUpdate = {
        staffId: staffMember.id,
        staffName: staffMember.name,
      };
    }

    const updatedRecord: StaffFinancialRecord = {
      ...staffFinancialRecords[recordIndex],
      ...updates,
      ...staffInfoUpdate,
      id: staffFinancialRecords[recordIndex].id,
    };

    staffFinancialRecords[recordIndex] = updatedRecord;
    writeData(FINANCIAL_COLLECTION, staffFinancialRecords);

    res.json({
      success: true,
      message: "Staff financial record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("[STAFF UPDATE_FINANCIAL_RECORD] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error updating staff financial record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const approveStaffFinancialRecord = (
  req: Request,
  res: Response<ApiResponse<StaffFinancialRecord>>
) => {
  try {
    const staffFinancialRecords = readData<StaffFinancialRecord>(FINANCIAL_COLLECTION);
    const { id } = req.params;
    const recordIndex = staffFinancialRecords.findIndex((rec) => rec.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Staff financial record not found",
      });
    }

    const currentRecord = staffFinancialRecords[recordIndex];
    if (currentRecord.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Paid records cannot be re-approved",
      });
    }

    const updatedRecord: StaffFinancialRecord = {
      ...currentRecord,
      status: "approved",
    };

    staffFinancialRecords[recordIndex] = updatedRecord;
    writeData(FINANCIAL_COLLECTION, staffFinancialRecords);

    // Notify Staff Member
    createNotification(
      updatedRecord.staffId,
      "Financial Record Approved",
      `Your ${updatedRecord.type} record for ₱${updatedRecord.amount.toLocaleString()} has been approved.`,
      "payment"
    );

    res.json({
      success: true,
      message: "Staff financial record approved successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("[STAFF APPROVE_FINANCIAL_RECORD] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error approving staff financial record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteStaffFinancialRecord = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const staffFinancialRecords = readData<StaffFinancialRecord>(FINANCIAL_COLLECTION);
    const { id } = req.params;
    const recordIndex = staffFinancialRecords.findIndex((rec) => rec.id === id);

    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Staff financial record not found",
      });
    }

    staffFinancialRecords.splice(recordIndex, 1);
    writeData(FINANCIAL_COLLECTION, staffFinancialRecords);

    res.json({
      success: true,
      message: "Staff financial record deleted successfully",
    });
  } catch (error) {
    console.error("[STAFF DELETE_FINANCIAL_RECORD] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting staff financial record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAttendance = (
  req: Request,
  res: Response<ApiResponse<Attendance[]>>
) => {
  try {
    const attendanceRecords = readData<Attendance>(ATTENDANCE_COLLECTION);
    res.json({
      success: true,
      message: "Attendance records retrieved successfully",
      data: attendanceRecords,
    });
  } catch (error) {
    console.error("[STAFF ATTENDANCE] Error fetching attendance records:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markAttendance = (
  req: Request,
  res: Response<ApiResponse<Attendance>>
) => {
  try {
    const attendanceRecords = readData<Attendance>(ATTENDANCE_COLLECTION);
    const attendanceData: Attendance = req.body;

    // Basic validation
    if (!attendanceData.staffId || !attendanceData.status || !attendanceData.date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: staffId, status, date",
      });
    }

    const newAttendance: Attendance = {
      ...attendanceData,
      id: `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    attendanceRecords.push(newAttendance);
    writeData(ATTENDANCE_COLLECTION, attendanceRecords);

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: newAttendance,
    });
  } catch (error) {
    console.error("[STAFF MARK_ATTENDANCE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error marking attendance",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
