import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Manual cookie parser (Express doesn't parse cookies by default)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const cookies: { [key: string]: string } = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  (req as any).cookies = cookies;
  next();
});

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

import patientRoutes from "./routes/patientRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import financeRoutes from "./routes/financeRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import paymentMethodRoutes from "./routes/paymentMethodRoutes";
import staffRoutes from "./routes/staffRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import authRoutes from "./routes/authRoutes";
import { initializeAuth } from "./controllers/authController";

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);

// app.get("/users", (req,res)=>{
//   res.send("Hello World")
// })

// Health check endpoint
app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "Server is running", timestamp: new Date() });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Start server
(async () => {
  try {
    // Initialize authentication (hash password)
    await initializeAuth();

    app.listen(PORT, () => {
      console.log(
        `🚀 Server is running on http://localhost:${PORT}`
      );
      console.log(`📍 Frontend URL: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
