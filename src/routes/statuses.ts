import express, { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { APPOINTMENT_STATUSES } from '../shared/appointmentStatuses';
import { PAYMENT_STATUSES } from '../shared/paymentStatuses';

const router = Router();

// Helper function to load statuses from JSON file
const loadStatusesFromFile = (filename: string) => {
  try {
    const filePath = path.join(process.cwd(), '..', 'villahermosa backend data', filename);
    console.log(`🔍 [STATUSES ROUTE] Attempting to load from: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log(`✅ [STATUSES ROUTE] File exists, reading content...`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      console.log(`✅ [STATUSES ROUTE] Successfully loaded statuses. Count: ${data.appointment ? data.appointment.length : 0}`);
      return data;
    } else {
      console.log(`❌ [STATUSES ROUTE] File does NOT exist at path: ${filePath}`);
    }
  } catch (error) {
    console.warn(`❌ [STATUSES ROUTE] Error loading ${filename}:`, error instanceof Error ? error.message : error);
  }
  return null;
};

/**
 * GET /api/statuses/appointments
 * Returns all available appointment statuses from statuses.json or defaults
 */
router.get('/appointments', (req: Request, res: Response) => {
  try {
    // Try to load from statuses.json file first
    const statusesData = loadStatusesFromFile('statuses.json');
    
    if (statusesData && statusesData.appointment && Array.isArray(statusesData.appointment)) {
      const appointmentStatuses = statusesData.appointment.map((status: any) => ({
        key: status.key,
        value: status.value,
        label: status.label,
        description: status.description,
        bgColor: status.bgColor || getDefaultBgColor(status.value),
        textColor: status.textColor || getDefaultTextColor(status.value)
      }));
      
      // Log the statuses being returned
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 BACKEND: RETURNING APPOINTMENT STATUSES FROM FILE');
      console.log('═══════════════════════════════════════════════════════════');
      appointmentStatuses.forEach((status: any, index: number) => {
        console.log(`${index + 1}. ${status.label} (${status.value})`);
      });
      console.log(`Total: ${appointmentStatuses.length} statuses`);
      console.log(`Has TBD: ${appointmentStatuses.some((s: any) => s.value === 'tbd') ? '✅ YES' : '❌ NO'}`);
      console.log('═══════════════════════════════════════════════════════════');
      
      res.json({
        success: true,
        data: appointmentStatuses,
        message: 'Appointment statuses retrieved successfully'
      });
    } else {
      // Fallback to hardcoded defaults
      console.log('⚠️  BACKEND: Using hardcoded defaults for appointment statuses (file not found)');
      res.json({
        success: true,
        data: APPOINTMENT_STATUSES,
        message: 'Appointment statuses retrieved successfully'
      });
    }
  } catch (error) {
    console.error('❌ Error fetching appointment statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statuses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/statuses/payments
 * Returns all available payment statuses
 */
router.get('/payments', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: PAYMENT_STATUSES,
      message: 'Payment statuses retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching payment statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statuses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to get default background color by status value
function getDefaultBgColor(status: string): string {
  const colorMap: Record<string, string> = {
    scheduled: 'bg-emerald-100',
    pending: 'bg-purple-100',
    reserved: 'bg-amber-100',
    cancelled: 'bg-red-100',
    completed: 'bg-blue-100',
    tbd: 'bg-red-100'
  };
  return colorMap[status] || 'bg-gray-100';
}

// Helper function to get default text color by status value
function getDefaultTextColor(status: string): string {
  const colorMap: Record<string, string> = {
    scheduled: 'text-emerald-700',
    pending: 'text-purple-700',
    reserved: 'text-amber-700',
    cancelled: 'text-red-700',
    completed: 'text-blue-700',
    tbd: 'text-red-700'
  };
  return colorMap[status] || 'text-gray-700';
}

export default router;
