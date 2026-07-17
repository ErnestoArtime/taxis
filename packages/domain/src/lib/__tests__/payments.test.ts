import { describe, it, expect } from 'vitest';
import { CashPaymentProvider, TransferPaymentProvider, calculateDriverEarning } from '../payments';

describe('CashPaymentProvider', () => {
  const provider = new CashPaymentProvider();

  it('creates a payment with pending status', async () => {
    const result = await provider.createPayment({
      tenantId: 't1',
      rideRequestId: 'r1',
      amount: 500,
      currency: 'CUP',
      method: 'cash',
      customerId: 'c1'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.providerReference).toContain('cash-r1');
  });

  it('verifies payment as paid', async () => {
    const status = await provider.verifyPayment('ref-1');
    expect(status).toBe('paid');
  });

  it('refunds payment', async () => {
    const result = await provider.refundPayment('ref-1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('refunded');
  });
});

describe('TransferPaymentProvider', () => {
  const provider = new TransferPaymentProvider();

  it('creates a payment with pending status', async () => {
    const result = await provider.createPayment({
      tenantId: 't1',
      rideRequestId: 'r1',
      amount: 1000,
      currency: 'CUP',
      method: 'transfer',
      customerId: 'c1'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
  });
});

describe('calculateDriverEarning', () => {
  it('calculates 10% commission by default', () => {
    const result = calculateDriverEarning(1000);
    expect(result.commissionAmount).toBe(100);
    expect(result.netAmount).toBe(900);
  });

  it('calculates custom commission rate', () => {
    const result = calculateDriverEarning(2000, 15);
    expect(result.commissionAmount).toBe(300);
    expect(result.netAmount).toBe(1700);
  });

  it('handles zero fare', () => {
    const result = calculateDriverEarning(0);
    expect(result.commissionAmount).toBe(0);
    expect(result.netAmount).toBe(0);
  });
});
