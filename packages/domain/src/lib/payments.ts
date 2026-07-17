export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'wallet' | 'operator_collect';

export interface Payment {
  id: string;
  tenantId: string;
  rideRequestId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider?: string;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInput {
  tenantId: string;
  rideRequestId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerId: string;
}

export interface PaymentResult {
  success: boolean;
  status: PaymentStatus;
  providerReference?: string;
  error?: string;
}

export interface PaymentProvider {
  createPayment(input: PaymentInput): Promise<PaymentResult>;
  verifyPayment(reference: string): Promise<PaymentStatus>;
  refundPayment(reference: string): Promise<PaymentResult>;
}

export interface DriverEarning {
  id: string;
  tenantId: string;
  driverId: string;
  rideRequestId: string;
  amount: number;
  currency: string;
  commissionAmount: number;
  netAmount: number;
  status: 'pending' | 'settled' | 'paid';
  createdAt: string;
}

export interface DriverSettlement {
  id: string;
  tenantId: string;
  driverId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commissionTotal: number;
  netAmount: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
}

// Cash payment provider — simplest for MVP
export class CashPaymentProvider implements PaymentProvider {
  async createPayment(input: PaymentInput): Promise<PaymentResult> {
    return {
      success: true,
      status: 'pending',
      providerReference: `cash-${input.rideRequestId}-${Date.now()}`
    };
  }

  async verifyPayment(reference: string): Promise<PaymentStatus> {
    return 'paid';
  }

  async refundPayment(reference: string): Promise<PaymentResult> {
    return { success: true, status: 'refunded', providerReference: `refund-${reference}` };
  }
}

// Bank transfer payment provider
export class TransferPaymentProvider implements PaymentProvider {
  async createPayment(input: PaymentInput): Promise<PaymentResult> {
    return {
      success: true,
      status: 'pending',
      providerReference: `transfer-${input.rideRequestId}-${Date.now()}`
    };
  }

  async verifyPayment(_reference: string): Promise<PaymentStatus> {
    return 'pending';
  }

  async refundPayment(reference: string): Promise<PaymentResult> {
    return { success: true, status: 'refunded', providerReference: `refund-${reference}` };
  }
}

export function calculateDriverEarning(
  fareAmount: number,
  commissionPercent: number = 10
): { commissionAmount: number; netAmount: number } {
  const commissionAmount = Math.round(fareAmount * (commissionPercent / 100) * 100) / 100;
  const netAmount = fareAmount - commissionAmount;
  return { commissionAmount, netAmount };
}
