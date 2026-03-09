import { Request, Response } from "express";
import { PaymentMethod, ApiResponse } from "../types/paymentMethod";
import { readData, writeData } from "../utils/storage";

const COLLECTION = "payment_methods";

export const getPaymentMethods = (req: Request, res: Response<ApiResponse<PaymentMethod[]>>) => {
  try {
    const paymentMethods = readData<PaymentMethod>(COLLECTION);
    const activeMethods = paymentMethods.filter(pm => pm.isActive);
    res.json({ success: true, data: activeMethods });
  } catch (error) {
    console.error('[GET PAYMENT METHODS] Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment methods', error: error instanceof Error ? error.message : error });
  }
};

export const createPaymentMethod = (req: Request, res: Response<ApiResponse<PaymentMethod>>) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const paymentMethods = readData<PaymentMethod>(COLLECTION);
    const existing = paymentMethods.find(pm => pm.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Payment method already exists' });
    }

    const newPaymentMethod: PaymentMethod = {
      id: `pm_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      name,
      description: description || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    paymentMethods.push(newPaymentMethod);
    writeData(COLLECTION, paymentMethods);

    res.status(201).json({ success: true, message: 'Payment method created', data: newPaymentMethod });
  } catch (error) {
    console.error('[CREATE PAYMENT METHOD] Error:', error);
    res.status(500).json({ success: false, message: 'Error creating payment method', error: error instanceof Error ? error.message : error });
  }
};
