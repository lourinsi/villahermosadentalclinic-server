import express, { Router, Request, Response } from 'express';
import { APPOINTMENT_STATUSES } from '../shared/appointmentStatuses';
import { PAYMENT_STATUSES } from '../shared/paymentStatuses';

const router = Router();

/**
 * GET /api/statuses/appointments
 * Returns all available appointment statuses
 */
router.get('/appointments', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: APPOINTMENT_STATUSES,
      message: 'Appointment statuses retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching appointment statuses:', error);
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

export default router;
