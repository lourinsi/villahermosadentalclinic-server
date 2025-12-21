import { Request, Response } from "express";
import { FinanceRecord, ApiResponse } from "../types/finance";

const financeRecords: FinanceRecord[] = [];

export const addFinanceRecord = (req: Request, res: Response<ApiResponse<FinanceRecord>>) => {
  try {
    const data: FinanceRecord = req.body;
    const record: FinanceRecord = {
      ...data,
      id: `finance_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    financeRecords.push(record);

    res.status(201).json({
      success: true,
      message: "Finance record added",
      data: record,
    });
  } catch (error) {
    console.error("[FINANCE CREATE] ERROR:", error);
    res.status(500).json({ success: false, message: "Error adding finance record", error: error instanceof Error ? error.message : String(error) });
  }
};

export const listFinance = (req: Request, res: Response<ApiResponse<FinanceRecord[]>>) => {
  try {
    // simple pagination
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const active = financeRecords.filter(r => !r.deleted);
    const total = active.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const items = active.slice(start, end);

    res.json({ success: true, message: "Finance records retrieved", data: items, meta: { total, page: pageNum, limit: limitNum, totalPages } });
  } catch (error) {
    console.error("[FINANCE LIST] ERROR:", error);
    res.status(500).json({ success: false, message: "Error listing finance records", error: error instanceof Error ? error.message : String(error) });
  }
};
