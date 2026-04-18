export interface PaymentStatusOption {
  key: number;
  value: string;
  label: string;
  description: string;
  bgColor?: string;
  textColor?: string;
}

export const PAYMENT_STATUSES: PaymentStatusOption[] = [
  {
    key: 1,
    value: "paid",
    label: "Paid",
    description: "Payment completed in full",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700"
  },
  {
    key: 2,
    value: "unpaid",
    label: "Unpaid",
    description: "Payment not yet made",
    bgColor: "bg-gray-50",
    textColor: "text-gray-700"
  },
  {
    key: 3,
    value: "half-paid",
    label: "Half Paid",
    description: "Partial payment received",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700"
  },
  {
    key: 4,
    value: "overdue",
    label: "Overdue",
    description: "Payment past due date",
    bgColor: "bg-red-50",
    textColor: "text-red-700"
  },
  {
    key: 5,
    value: "pay-at-clinic",
    label: "Pay at Clinic",
    description: "Payment to be made at clinic",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700"
  },
];

/**
 * Get payment status option by value/key
 */
export const getPaymentStatusOption = (statusValue: string | number): PaymentStatusOption | undefined => {
  if (typeof statusValue === 'number') {
    return PAYMENT_STATUSES.find(s => s.key === statusValue);
  }
  return PAYMENT_STATUSES.find(s => s.value === statusValue);
};

/**
 * Get payment status label by value
 */
export const getPaymentStatusLabel = (statusValue: string | number): string => {
  const status = getPaymentStatusOption(statusValue);
  return status?.label || String(statusValue);
};

/**
 * Get payment status description by value
 */
export const getPaymentStatusDescription = (statusValue: string | number): string => {
  const status = getPaymentStatusOption(statusValue);
  return status?.description || '';
};

/**
 * All valid payment status values
 */
export const VALID_PAYMENT_STATUS_VALUES = PAYMENT_STATUSES.map(s => s.value);

/**
 * Check if a value is a valid payment status
 */
export const isValidPaymentStatus = (value: string | number): boolean => {
  if (typeof value === 'number') {
    return PAYMENT_STATUSES.some(s => s.key === value);
  }
  return VALID_PAYMENT_STATUS_VALUES.includes(value);
};

/**
 * Payment Status type for TypeScript
 */
export type PaymentStatus = typeof PAYMENT_STATUSES[number]['value'];
