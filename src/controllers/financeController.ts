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
import { prisma } from "../lib/prisma";

const toFinanceRecord = (record: unknown): FinanceRecord => record as FinanceRecord;
const toDetailedExpense = (expense: unknown): DetailedExpense => expense as DetailedExpense;

export const createFinanceRecord = async (
  req: Request,
  res: Response<ApiResponse<FinanceRecord>>
) => {
  try {
    const financeData: FinanceRecord = req.body;

    if (!financeData.type || !financeData.amount || !financeData.date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: type, amount, date",
      });
    }

    const newRecord = toFinanceRecord(
      await prisma.financeRecord.create({
        data: {
          id: `fin_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          patientId: financeData.patientId || null,
          type: financeData.type,
          amount: Number(financeData.amount),
          date: financeData.date,
          description: financeData.description || "",
          createdAt: new Date(),
          updatedAt: new Date(),
          deleted: false,
        },
      })
    );

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

export const createDetailedExpense = async (
  req: Request,
  res: Response<ApiResponse<DetailedExpense>>
) => {
  try {
    const expenseData: DetailedExpense = req.body;

    if (!expenseData.category || !expenseData.description || !expenseData.amount || !expenseData.date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: category, description, amount, date",
      });
    }

    const newExpense = toDetailedExpense(
      await prisma.detailedExpense.create({
        data: {
          id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          date: expenseData.date,
          category: expenseData.category,
          description: expenseData.description,
          amount: Number(expenseData.amount),
          vendor: expenseData.vendor || "",
          paymentMethod: expenseData.paymentMethod || "",
          status: "pending",
          recurring: false,
        },
      })
    );

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

export const getAllFinanceRecords = async (
  req: Request,
  res: Response<ApiResponse<FinanceRecord[]>>
) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const [total, items] = await Promise.all([
      prisma.financeRecord.count({ where: { deleted: false } }),
      prisma.financeRecord.findMany({
        where: { deleted: false },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      message: "Finance records retrieved successfully",
      data: items as unknown as FinanceRecord[],
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
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

export const getFinanceRecordById = async (
  req: Request,
  res: Response<ApiResponse<FinanceRecord | null>>
) => {
  try {
    const record = await prisma.financeRecord.findUnique({ where: { id: req.params.id } });
    if (!record || record.deleted) {
      return res.status(404).json({ success: false, message: "Finance record not found" });
    }

    res.json({
      success: true,
      message: "Finance record retrieved successfully",
      data: toFinanceRecord(record),
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

export const updateFinanceRecord = async (
  req: Request,
  res: Response<ApiResponse<FinanceRecord | null>>
) => {
  try {
    const record = await prisma.financeRecord.findUnique({ where: { id: req.params.id } });
    if (!record || record.deleted) {
      return res.status(404).json({ success: false, message: "Finance record not found" });
    }

    const updates = req.body;
    const updatedRecord = toFinanceRecord(
      await prisma.financeRecord.update({
        where: { id: req.params.id },
        data: {
          ...(updates.patientId !== undefined && { patientId: updates.patientId }),
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.amount !== undefined && { amount: Number(updates.amount) }),
          ...(updates.date !== undefined && { date: updates.date }),
          ...(updates.description !== undefined && { description: updates.description }),
          updatedAt: new Date(),
        },
      })
    );

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

export const deleteFinanceRecord = async (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const record = await prisma.financeRecord.findUnique({ where: { id: req.params.id } });
    if (!record || record.deleted) {
      return res.status(404).json({ success: false, message: "Finance record not found" });
    }

    await prisma.financeRecord.update({
      where: { id: req.params.id },
      data: { deleted: true, deletedAt: new Date(), updatedAt: new Date() },
    });

    res.json({ success: true, message: "Finance record soft-deleted successfully" });
  } catch (error) {
    console.error("[FINANCE DELETE] Error deleting finance record:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting finance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getRevenue = async (req: Request, res: Response<ApiResponse<Revenue[]>>) => {
  try {
    res.json({ success: true, message: "Revenue data retrieved successfully", data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching revenue data", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const getExpenseBreakdown = async (
  req: Request,
  res: Response<ApiResponse<ExpenseBreakdown[]>>
) => {
  try {
    res.json({ success: true, message: "Expense breakdown retrieved successfully", data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching expense breakdown", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const getDetailedExpenses = async (
  req: Request,
  res: Response<ApiResponse<DetailedExpense[]>>
) => {
  try {
    const detailedExpenses = await prisma.detailedExpense.findMany({
      orderBy: { date: "desc" },
    });
    res.json({
      success: true,
      message: "Detailed expenses retrieved successfully",
      data: detailedExpenses as unknown as DetailedExpense[],
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

export const getRecurringExpenses = async (
  req: Request,
  res: Response<ApiResponse<RecurringExpense[]>>
) => {
  try {
    res.json({ success: true, message: "Recurring expenses retrieved successfully", data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching recurring expenses", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const getPayroll = async (req: Request, res: Response<ApiResponse<Payroll[]>>) => {
  try {
    res.json({ success: true, message: "Payroll data retrieved successfully", data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching payroll data", error: error instanceof Error ? error.message : "Unknown error" });
  }
};

export const getRecentTransactions = async (
  req: Request,
  res: Response<ApiResponse<RecentTransaction[]>>
) => {
  try {
    res.json({ success: true, message: "Recent transactions retrieved successfully", data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching recent transactions", error: error instanceof Error ? error.message : "Unknown error" });
  }
};
