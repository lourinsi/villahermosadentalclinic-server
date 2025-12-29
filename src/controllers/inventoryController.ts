import { Request, Response } from "express";
import { InventoryItem, ApiResponse } from "../types/inventory";

// Temporary in-memory storage (replace with database later)
const inventoryItems: InventoryItem[] = [];
let inventoryIdCounter = 0;

// --- CRUD Operations ---

export const createInventoryItem = (
  req: Request,
  res: Response<ApiResponse<InventoryItem>>
) => {
  try {
    console.log("[INVENTORY CREATE] Received request body:", req.body);
    const itemData: InventoryItem = req.body;

    // Basic validation
    if (!itemData.item || !itemData.quantity || !itemData.unit || !itemData.costPerUnit) {
      console.error("[INVENTORY CREATE] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields: item, quantity, unit, costPerUnit",
      });
    }

    console.log("[INVENTORY CREATE] Creating inventory item:", itemData.item);

    const newItem: InventoryItem = {
      id: `inv_${Date.now()}_${inventoryIdCounter++}`,
      ...itemData,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
    };

    inventoryItems.push(newItem);
    console.log("[INVENTORY CREATE] Inventory item saved. Total items:", inventoryItems.length);

    res.status(201).json({
      success: true,
      message: "Inventory item added successfully",
      data: newItem,
    });
  } catch (error) {
    console.error("[INVENTORY CREATE] ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error adding inventory item",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllInventoryItems = (
  req: Request,
  res: Response<ApiResponse<InventoryItem[]>>
) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    const activeItems = inventoryItems.filter((item) => !item.deleted);
    const total = activeItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const items = activeItems.slice(start, end);

    res.json({
      success: true,
      message: "Inventory items retrieved successfully",
      data: items,
      meta: { total, page: pageNum, limit: limitNum, totalPages },
    });
  } catch (error) {
    console.error("[INVENTORY GET_ALL] Error fetching inventory items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory items",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getInventoryItemById = (
  req: Request,
  res: Response<ApiResponse<InventoryItem | null>>
) => {
  try {
    const { id } = req.params;
    const item = inventoryItems.find((rec) => rec.id === id);

    if (!item || item.deleted) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Inventory item retrieved successfully",
      data: item,
    });
  } catch (error) {
    console.error("[INVENTORY GET_BY_ID] Error fetching inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory item",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateInventoryItem = (
  req: Request,
  res: Response<ApiResponse<InventoryItem | null>>
) => {
  try {
    const { id } = req.params;
    const updates: Partial<InventoryItem> = req.body;

    const itemIndex = inventoryItems.findIndex((rec) => rec.id === id);
    if (itemIndex === -1 || inventoryItems[itemIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const updatedItem: InventoryItem = {
      ...inventoryItems[itemIndex],
      ...updates,
      id: inventoryItems[itemIndex].id, // Prevent ID change
      updatedAt: new Date(),
    };

    inventoryItems[itemIndex] = updatedItem;

    res.json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error("[INVENTORY UPDATE] Error updating inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Error updating inventory item",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteInventoryItem = (
  req: Request,
  res: Response<ApiResponse<null>>
) => {
  try {
    const { id } = req.params;
    const itemIndex = inventoryItems.findIndex((rec) => rec.id === id);

    if (itemIndex === -1 || inventoryItems[itemIndex].deleted) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    // soft delete
    inventoryItems[itemIndex] = {
      ...inventoryItems[itemIndex],
      deleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("[INVENTORY DELETE] Soft-deleted inventory item:", inventoryItems[itemIndex]);

    res.json({
      success: true,
      message: "Inventory item soft-deleted successfully",
    });
  } catch (error) {
    console.error("[INVENTORY DELETE] Error deleting inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting inventory item",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};