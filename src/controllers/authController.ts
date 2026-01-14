import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Hardcoded admin credentials (in production, use a database)
const ADMIN_USERNAME = "admin";
// Simple plaintext password for now - we'll hash it on startup
const ADMIN_PASSWORD = "password";
let ADMIN_PASSWORD_HASH: string;

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production";
const JWT_EXPIRY = "24h";

/**
 * Initialize auth - hash the password on startup
 */
export const initializeAuth = async () => {
  try {
    ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log("[AUTH] Password hash initialized");
  } catch (error) {
    console.error("[AUTH] Failed to initialize password hash:", error);
    throw error;
  }
};

/**
 * Login endpoint - validates credentials and returns JWT token
 */
export const login = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const { username, password } = req.body;

    console.log("[AUTH] Login attempt for username:", username);
    console.log("[AUTH] Password received length:", password ? password.length : 0);
    console.log("[AUTH] Password value:", password);

    // Validate input
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
      return;
    }

    // Check username
    if (username !== ADMIN_USERNAME) {
      console.log("[AUTH] Invalid username:", username);
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Check password
    console.log("[AUTH] Comparing password...");
    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    console.log("[AUTH] Password comparison result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("[AUTH] Invalid password for user:", username);
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: "admin",
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log("[AUTH] Login successful for user:", username);

    // Send token as httpOnly cookie (secure)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    });

    // Also return token in response for client-side use
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        username: ADMIN_USERNAME,
        role: "admin",
      },
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
