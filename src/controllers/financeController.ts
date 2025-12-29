import { Request, Response } from "express";
import {
  FinanceRecord,
  ApiResponse,
  Revenue,
  ExpenseBreakdown,
  DetailedExpense,
  RecurringExpense,
  Payroll,
  RecentTransaction,
} from "../types/finance";

// Temporary in-memory storage (replace with database later)
const financeRecords: FinanceRecord[] = [];
const detailedExpenses: DetailedExpense[] = [];
let financeIdCounter = 0;
let detailedExpenseIdCounter = 0;

// --- CRUD Operations ---

export const createFinanceRecord = (
  req: Request,
  res: Response<ApiResponse<FinanceRecord>>
) => {
  try {
    console.log("[FINANCE CREATE] Received request body:", req.body);
    const financeData: FinanceRecord = req.body;

    // Basic validation
    if (!financeData.type || !financeData.amount || !financeData.date) {
      console.error("[FINANCE CREATE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: type, amount, date",
      });
    }

    console.log("[FINANCE CREATE] Creating finance record of type:", financeData.type);

    const newRecord: FinanceRecord = {
      id: `fin_${Date.now()}_${financeIdCounter++}`,
      ...financeData,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    financeRecords.push(newRecord);
    console.log("[FINANCE CREATE] Finance record saved. Total records:", financeRecords.length);

    res.status(201).json({
      success: true,
      message: "Finance record added successfully",
      data: newRecord,
    });
  } catch (error) {
    console.error("[FINANCE CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding finance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createDetailedExpense = (
  req: Request,
  res: Response<ApiResponse<DetailedExpense>>
) => {
  try {
    const expenseData: DetailedExpense = req.body;

    // Basic validation
    if (!expenseData.category || !expenseData.description || !expenseData.amount || !expenseData.date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: category, description, amount, date",
      });
    }

    const newExpense: DetailedExpense = {
      ...expenseData,
      id: `exp_${Date.now()}_${detailedExpenseIdCounter++}`,
      status: 'pending',
      recurring: false, // default value
    };

    detailedExpenses.push(newExpense);

    res.status(201).json({
      success: true,
      message: "Detailed expense added successfully",
      data: newExpense,
    });
  } catch (error) {
    console.error("[FINANCE CREATE_DETAILED_EXPENSE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding detailed expense",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllFinanceRecords = (
  req: Request,
  res: Response<ApiResponse<FinanceRecord[]>>
) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const activeRecords = financeRecords.filter((r) => !r.deleted);
    const total = activeRecords.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const items = activeRecords.slice(start, end);

    res.json({
      success: true,
      message: "Finance records retrieved successfully",
      data: items,
      meta: { total, page: pageNum, limit: limitNum, totalPages },
    });
  } catch (error) {
    console.error("[FINANCE GET_ALL] Error fetching finance records:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching finance records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getFinanceRecordById = (
  req: Request,
  res: Response<ApiResponse<FinanceRecord | null>>
) => {
  try {
    const { id } = req.params;
    const record = financeRecords.find((rec) => rec.id === id);

    if (!record || record.deleted) {
      return res.status(404).json({
        success: false,
        message: "Finance record not found",
      });
    }

    res.json({
      success: true,
      message: "Finance record retrieved successfully",
      data: record,
    });
  } catch (error) {
    console.error("[FINANCE GET_BY_ID] Error fetching finance record:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching finance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateFinanceRecord = (
  req: Request,
  res: Response<ApiResponse<FinanceRecord | null>>
) => {
  try {
    const { id } = req.params;
    const updates: Partial<FinanceRecord> = req.body;

    const recordIndex = financeRecords.findIndex((rec) => rec.id === id);
    if (recordIndex === -1 || financeRecords[recordIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Finance record not found",
      });
    }

    const updatedRecord: FinanceRecord = {
      ...financeRecords[recordIndex],
      ...updates,
      id: financeRecords[recordIndex].id, // Prevent ID change
      updatedAt: new Date(),
    };

    financeRecords[recordIndex] = updatedRecord;

    res.json({
      success: true,
      message: "Finance record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("[FINANCE UPDATE] Error updating finance record:", error);
    res.status(500).json({
      success: false,
      message: "Error updating finance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteFinanceRecord = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const recordIndex = financeRecords.findIndex((rec) => rec.id === id);

    if (recordIndex === -1 || financeRecords[recordIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Finance record not found",
      });
    }

    // soft delete
    financeRecords[recordIndex] = {
      ...financeRecords[recordIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("[FINANCE DELETE] Soft-deleted finance record:", financeRecords[recordIndex]);

    res.json({
      success: true,
      message: "Finance record soft-deleted successfully",
    });
  } catch (error) {
    console.error("[FINANCE DELETE] Error deleting finance record:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting finance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// --- Finance-specific Endpoints ---

export const getRevenue = (req: Request, res: Response<ApiResponse<Revenue[]>>) => {
  try {
    // TODO: Replace with actual logic querying financeRecords
    const data: Revenue[] = [];
    res.json({
      success: true,
      message: "Revenue data retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("[FINANCE REVENUE] Error fetching revenue data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getExpenseBreakdown = (
  req: Request,
  res: Response<ApiResponse<ExpenseBreakdown[]>>
) => {
  try {
    // TODO: Replace with actual logic querying financeRecords
    const data: ExpenseBreakdown[] = [];
    res.json({
      success: true,
      message: "Expense breakdown retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("[FINANCE EXPENSE_BREAKDOWN] Error fetching expense breakdown:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching expense breakdown",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getDetailedExpenses = (
  req: Request,
  res: Response<ApiResponse<DetailedExpense[]>>
) => {
  try {
    res.json({
      success: true,
      message: "Detailed expenses retrieved successfully",
      data: detailedExpenses,
    });
  } catch (error) {
    console.error("[FINANCE DETAILED_EXPENSES] Error fetching detailed expenses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching detailed expenses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getRecurringExpenses = (
  req: Request,
  res: Response<ApiResponse<RecurringExpense[]>>
) => {
  try {
    // TODO: Replace with actual logic querying financeRecords
    const data: RecurringExpense[] = [];
    res.json({
      success: true,
      message: "Recurring expenses retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("[FINANCE RECURRING_EXPENSES] Error fetching recurring expenses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recurring expenses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPayroll = (req: Request, res: Response<ApiResponse<Payroll[]>>) => {
  try {
    // TODO: Replace with actual logic querying financeRecords
    const data: Payroll[] = [];
    res.json({
      success: true,
      message: "Payroll data retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("[FINANCE PAYROLL] Error fetching payroll data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payroll data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getRecentTransactions = (
  req: Request,
  res: Response<ApiResponse<RecentTransaction[]>>
) => {
  try {
    // TODO: Replace with actual logic querying financeRecords
    const data: RecentTransaction[] = [];
    res.json({
      success: true,
      message: "Recent transactions retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("[FINANCE RECENT_TRANSACTIONS] Error fetching recent transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent transactions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};