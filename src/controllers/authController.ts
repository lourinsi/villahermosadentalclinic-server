import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readData } from "../utils/storage";
import { Staff } from "../types/staff";

// Hardcoded admin credentials (in production, use a database)
const ADMIN_USERNAME = "admin";
// Simple plaintext password for now - we'll hash it on startup
const ADMIN_PASSWORD = "password";
let ADMIN_PASSWORD_HASH: string;

// Default password for doctors (in production, each doctor should have their own password)
const DEFAULT_DOCTOR_PASSWORD = "doctor123";
let DOCTOR_PASSWORD_HASH: string;

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production";
const JWT_EXPIRY = "24h";
const STAFF_COLLECTION = "staff";

/**
 * Initialize auth - hash the passwords on startup
 */
export const initializeAuth = async () => {
  try {
    ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10);
    DOCTOR_PASSWORD_HASH = await bcrypt.hash(DEFAULT_DOCTOR_PASSWORD, 10);
    console.log("[AUTH] Password hashes initialized");
  } catch (error) {
    console.error("[AUTH] Failed to initialize password hash:", error);
    throw error;
  }
};

/**
 * Login endpoint - validates credentials and returns JWT token
 * Supports both admin and doctor logins
 */
export const login = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const { username, password } = req.body;

    console.log("[AUTH] Login attempt for username:", username);

    // Validate input
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
      return;
    }

    // First, check if it's the admin user
    if (username === ADMIN_USERNAME) {
      const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

      if (!isPasswordValid) {
        console.log("[AUTH] Invalid password for admin");
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Generate JWT token for admin
      const token = jwt.sign(
        {
          username: ADMIN_USERNAME,
          role: "admin",
          iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      console.log("[AUTH] Admin login successful");

      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          username: ADMIN_USERNAME,
          role: "admin",
        },
      });
      return;
    }

    // Check if it's a doctor (staff member with role "Doctor")
    const staffMembers = readData<Staff>(STAFF_COLLECTION);
    const doctor = staffMembers.find(
      (staff) =>
        staff.name.toLowerCase() === username.toLowerCase() &&
        staff.role === "Doctor" &&
        !staff.deleted
    );

    if (doctor) {
      // For doctors, check against default password (or staff-specific password in future)
      const isPasswordValid = await bcrypt.compare(password, DOCTOR_PASSWORD_HASH);

      if (!isPasswordValid) {
        console.log("[AUTH] Invalid password for doctor:", username);
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Generate JWT token for doctor
      const token = jwt.sign(
        {
          username: doctor.name,
          role: "doctor",
          staffId: doctor.id,
          iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      console.log("[AUTH] Doctor login successful:", doctor.name);

      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          username: doctor.name,
          role: "doctor",
          staffId: doctor.id,
        },
      });
      return;
    }

    // No matching user found
    console.log("[AUTH] Invalid username:", username);
    res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login",
    });
  }
};

/**
 * Logout endpoint - clears the auth token
 */
export const logout = (
  req: express.Request,
  res: express.Response
): void => {
  try {
    console.log("[AUTH] Logout");

    // Clear the auth token cookie
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during logout",
    });
  }
};

/**
 * Verify token endpoint - checks if the current token is valid
 */
export const verifyToken = (
  req: express.Request,
  res: express.Response
): void => {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.status(200).json({
      success: true,
      message: "Token is valid",
      user: decoded,
    });
  } catch (error) {
    console.error("[AUTH] Token verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * Utility function to hash a password (for testing/setup purposes)
 * Usage: In terminal, run: ts-node -e "import {hashPassword} from './authController'; hashPassword('password').then(console.log)"
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};
