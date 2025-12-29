import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import patientRoutes from "./routes/patientRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import financeRoutes from "./routes/financeRoutes";
import staffRoutes from "./routes/staffRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";

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

// Routes
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/inventory", inventoryRoutes);

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
app.listen(PORT, () => {
  console.log(
    `🚀 Server is running on http://localhost:${PORT}`
  );
  console.log(`📍 Frontend URL: ${FRONTEND_URL}`);
});
