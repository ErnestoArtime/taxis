import { describe, it, expect } from 'vitest';
import { calculatePrice, applyExtraCharges } from '../pricing-service';
import type { TariffRule } from '../pricing';

const baseRules: TariffRule[] = [
  {
    id: '1', tenantId: 't1', kind: 'base', label: 'Tarifa base', amount: 600,
    currency: 'CUP', priority: 10, isActive: true
  },
  {
    id: '2', tenantId: 't1', kind: 'distance', label: 'Por kilometro', amount: 80,
    currency: 'CUP', priority: 20, isActive: true
  },
  {
    id: '3', tenantId: 't1', kind: 'time', label: 'Por minuto', amount: 10,
    currency: 'CUP', priority: 30, isActive: true
  },
  {
    id: '4', tenantId: 't1', kind: 'minimum', label: 'Tarifa minima', amount: 500,
    currency: 'CUP', priority: 100, isActive: true
  }
];

describe('calculatePrice', () => {
  it('calculates base + distance + time', () => {
    const result = calculatePrice(baseRules, {
      tenantId: 't1',
      distanceKm: 10,
      durationMinutes: 25,
      pickupAt: new Date().toISOString()
    });

    expect(result.breakdown).toHaveLength(3);
    expect(result.subtotal).toBe(600 + 800 + 250); // base + 10*80 + 25*10
    expect(result.minimumApplied).toBe(false);
    expect(result.currency).toBe('CUP');
  });

  it('applies minimum when subtotal is below minimum', () => {
    const rules: TariffRule[] = [
      { id: '1', tenantId: 't1', kind: 'base', label: 'Base', amount: 100, currency: 'CUP', priority: 10, isActive: true },
      { id: '2', tenantId: 't1', kind: 'minimum', label: 'Minimo', amount: 500, currency: 'CUP', priority: 100, isActive: true }
    ];

    const result = calculatePrice(rules, {
      tenantId: 't1',
      pickupAt: new Date().toISOString()
    });

    expect(result.subtotal).toBe(500); // minimum applied
    expect(result.minimumApplied).toBe(true);
  });

  it('filters rules by vehicle class', () => {
    const rules: TariffRule[] = [
      { id: '1', tenantId: 't1', kind: 'base', label: 'Base estandar', amount: 600, currency: 'CUP', priority: 10, isActive: true },
      { id: '2', tenantId: 't1', kind: 'base', label: 'Base confort', amount: 900, currency: 'CUP', priority: 10, isActive: true, vehicleClassId: 'confort' }
    ];

    const result = calculatePrice(rules, {
      tenantId: 't1',
      vehicleClassId: 'confort',
      pickupAt: new Date().toISOString()
    });

    // Should include both: one general, one specific to confort
    expect(result.breakdown).toHaveLength(2);
    expect(result.subtotal).toBe(600 + 900);
  });

  it('filters rules by time window', () => {
    // Rules with absolute date windows
    const earlyRule: TariffRule = {
      id: '1', tenantId: 't1', kind: 'base', label: 'Diurno', amount: 500,
      currency: 'CUP', priority: 10, isActive: true,
      startsAt: '2024-01-01T06:00:00Z', endsAt: '2024-06-01T18:00:00Z'
    };
    const lateRule: TariffRule = {
      id: '2', tenantId: 't1', kind: 'surge', label: 'Nocturno', amount: 200,
      currency: 'CUP', priority: 5, isActive: true,
      startsAt: '2024-06-01T18:00:00Z', endsAt: '2024-09-30T06:00:00Z'
    };

    // June 15 10:00 — inside earlyRule, outside lateRule
    const dayResult = calculatePrice([earlyRule, lateRule], {
      tenantId: 't1',
      pickupAt: '2024-05-15T10:00:00Z'
    });
    expect(dayResult.breakdown.some(b => b.label === 'Diurno')).toBe(true);
    expect(dayResult.breakdown.some(b => b.label === 'Nocturno')).toBe(false);

    // August 15 22:00 — inside lateRule, outside earlyRule
    const nightResult = calculatePrice([earlyRule, lateRule], {
      tenantId: 't1',
      pickupAt: '2024-08-15T22:00:00Z'
    });
    expect(nightResult.breakdown.some(b => b.label === 'Nocturno')).toBe(true);
    expect(nightResult.breakdown.some(b => b.label === 'Diurno')).toBe(false);
  });

  it('respects rule priority ordering', () => {
    const rules: TariffRule[] = [
      { id: '1', tenantId: 't1', kind: 'base', label: 'Alta prioridad', amount: 1000, currency: 'CUP', priority: 1, isActive: true },
      { id: '2', tenantId: 't1', kind: 'base', label: 'Baja prioridad', amount: 500, currency: 'CUP', priority: 99, isActive: true }
    ];

    const result = calculatePrice(rules, {
      tenantId: 't1',
      pickupAt: new Date().toISOString()
    });

    expect(result.breakdown).toHaveLength(2);
  });

  it('ignores inactive rules', () => {
    const rules: TariffRule[] = [
      { id: '1', tenantId: 't1', kind: 'base', label: 'Activa', amount: 500, currency: 'CUP', priority: 10, isActive: true },
      { id: '2', tenantId: 't1', kind: 'base', label: 'Inactiva', amount: 999, currency: 'CUP', priority: 10, isActive: false }
    ];

    const result = calculatePrice(rules, {
      tenantId: 't1',
      pickupAt: new Date().toISOString()
    });

    expect(result.breakdown.some(b => b.label === 'Inactiva')).toBe(false);
  });

  it('generates price snapshot', () => {
    const result = calculatePrice(baseRules, {
      tenantId: 't1',
      distanceKm: 5,
      durationMinutes: 15,
      passengerCount: 2,
      pickupAt: '2024-06-15T10:00:00Z'
    });

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.rulesApplied).toHaveLength(3);
    expect(result.snapshot.parameters.distanceKm).toBe(5);
    expect(result.snapshot.parameters.durationMinutes).toBe(15);
    expect(result.snapshot.parameters.passengerCount).toBe(2);
    expect(result.snapshot.total).toBeGreaterThan(0);
  });
});

describe('applyExtraCharges', () => {
  it('adds waiting time charge', () => {
    const base = calculatePrice(baseRules, {
      tenantId: 't1',
      distanceKm: 10,
      durationMinutes: 25,
      pickupAt: new Date().toISOString()
    });

    const withWaiting = applyExtraCharges(base, { waitingMinutes: 15 });
    expect(withWaiting.subtotal).toBe(base.subtotal + 150); // 15 * 10
  });

  it('adds round trip surcharge', () => {
    const base = calculatePrice(baseRules, {
      tenantId: 't1',
      distanceKm: 10,
      durationMinutes: 25,
      pickupAt: new Date().toISOString()
    });

    const withRoundTrip = applyExtraCharges(base, { roundTrip: true });
    expect(withRoundTrip.subtotal).toBe(base.subtotal + base.subtotal * 0.5);
  });
});
