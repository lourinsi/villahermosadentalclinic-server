import { Router } from "express";
import { addFinanceRecord, listFinance } from "../controllers/financeController";

const router = Router();

router.post("/", addFinanceRecord);
router.get("/", listFinance);

export default router;
