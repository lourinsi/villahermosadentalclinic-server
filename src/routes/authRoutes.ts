import express from "express";
import { login, logout, verifyToken } from "../controllers/authController";

const router = express.Router();

// Authentication routes
router.post("/login", login);
router.post("/logout", logout);
router.get("/verify", verifyToken);

export default router;
