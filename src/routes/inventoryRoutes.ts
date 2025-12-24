import { Router } from "express";
import {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
} from "../controllers/inventoryController";

const router = Router();

// POST - Add new inventory item
router.post("/", createInventoryItem);

// GET - Get all inventory items
router.get("/", getAllInventoryItems);

// GET - Get inventory item by ID
router.get("/:id", getInventoryItemById);

// PUT - Update inventory item
router.put("/:id", updateInventoryItem);

// DELETE - Delete inventory item
router.delete("/:id", deleteInventoryItem);

export default router;