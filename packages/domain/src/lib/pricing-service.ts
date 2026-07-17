import { TariffRule, TariffRuleKind, PriceEstimate, PriceEstimateRequest, VehicleClass } from './pricing';

export interface PriceBreakdownItem {
  label: string;
  kind: TariffRuleKind;
  amount: number;
}

export interface PriceSnapshot {
  currency: string;
  subtotal: number;
  minimumApplied: boolean;
  total: number;
  breakdown: PriceBreakdownItem[];
  rulesApplied: Array<{
    ruleId: string;
    label: string;
    kind: TariffRuleKind;
    amount: number;
    computedAmount: number;
  }>;
  parameters: {
    distanceKm?: number;
    durationMinutes?: number;
    passengerCount: number;
    pickupAt: string;
  };
}

export function calculatePrice(
  rules: TariffRule[],
  request: PriceEstimateRequest & { passengerCount?: number },
  currency?: string
): PriceEstimate & { snapshot: PriceSnapshot } {
  const pickupAt = new Date(request.pickupAt);
  const distanceKm = request.distanceKm ?? 0;
  const durationMinutes = request.durationMinutes ?? 0;

  // Filter applicable rules
  const applicable = rules.filter(r => {
    if (!r.isActive) return false;
    if (r.vehicleClassId && r.vehicleClassId !== request.vehicleClassId) return false;
    if (r.startsAt && new Date(r.startsAt) > pickupAt) return false;
    if (r.endsAt && new Date(r.endsAt) < pickupAt) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority);

  const resolvedCurrency = currency ?? 'CUP';

  // Calculate each rule
  const breakdown: PriceBreakdownItem[] = [];
  const rulesApplied: PriceSnapshot['rulesApplied'] = [];

  let subtotal = 0;

  for (const rule of applicable) {
    if (rule.kind === 'minimum') continue; // handled at the end

    let computedAmount = rule.amount;

    switch (rule.kind) {
      case 'distance':
        computedAmount = rule.amount * distanceKm;
        break;
      case 'time':
        computedAmount = rule.amount * durationMinutes;
        break;
      // base and surge are flat amounts
    }

    subtotal += computedAmount;

    breakdown.push({
      label: rule.label,
      kind: rule.kind,
      amount: computedAmount
    });

    rulesApplied.push({
      ruleId: rule.id,
      label: rule.label,
      kind: rule.kind,
      amount: rule.amount,
      computedAmount
    });
  }

  // Apply minimum
  const minimumRule = applicable.find(r => r.kind === 'minimum');
  const minimumAmount = minimumRule?.amount ?? 0;
  const minimumApplied = subtotal < minimumAmount;
  const total = Math.max(subtotal, minimumAmount);

  if (minimumApplied && minimumAmount > 0) {
    breakdown.push({
      label: minimumRule?.label ?? 'Tarifa minima',
      kind: 'minimum',
      amount: minimumAmount - subtotal
    });
  }

  const snapshot: PriceSnapshot = {
    currency: resolvedCurrency,
    subtotal,
    minimumApplied,
    total,
    breakdown: breakdown.map(b => ({
      label: b.label,
      kind: b.kind as TariffRuleKind,
      amount: b.amount
    })),
    rulesApplied,
    parameters: {
      distanceKm: request.distanceKm,
      durationMinutes: request.durationMinutes,
      passengerCount: request.passengerCount ?? 1,
      pickupAt: request.pickupAt
    }
  };

  return {
    currency: resolvedCurrency,
    subtotal: total,
    minimumApplied,
    breakdown: breakdown.map(b => ({ label: b.label, amount: b.amount })),
    snapshot
  };
}

export function applyExtraCharges(
  estimate: PriceEstimate & { snapshot: PriceSnapshot },
  extras: {
    waitingMinutes?: number;
    luggageCount?: number;
    passengerCount?: number;
    roundTrip?: boolean;
    airportSurcharge?: number;
  }
): PriceEstimate & { snapshot: PriceSnapshot } {
  const extraBreakdown: PriceBreakdownItem[] = [...estimate.snapshot.breakdown];
  let extraTotal = 0;

  if (extras.waitingMinutes && extras.waitingMinutes > 0) {
    const waitingCharge = extras.waitingMinutes * 10; // 10 CUP/min waiting
    extraBreakdown.push({ label: 'Tiempo de espera', kind: 'time', amount: waitingCharge });
    extraTotal += waitingCharge;
  }

  if (extras.luggageCount && extras.luggageCount > 2) {
    const luggageCharge = (extras.luggageCount - 2) * 50; // 50 CUP per extra luggage
    extraBreakdown.push({ label: 'Equipaje extra', kind: 'base', amount: luggageCharge });
    extraTotal += luggageCharge;
  }

  if (extras.roundTrip) {
    const roundTripCharge = estimate.subtotal * 0.5; // 50% surcharge for round trip
    extraBreakdown.push({ label: 'Ida y vuelta', kind: 'surge', amount: roundTripCharge });
    extraTotal += roundTripCharge;
  }

  if (extras.airportSurcharge && extras.airportSurcharge > 0) {
    extraBreakdown.push({ label: 'Recargo aeropuerto', kind: 'surge', amount: extras.airportSurcharge });
    extraTotal += extras.airportSurcharge;
  }

  const newTotal = estimate.subtotal + extraTotal;

  return {
    currency: estimate.currency,
    subtotal: newTotal,
    minimumApplied: estimate.minimumApplied,
    breakdown: [...estimate.breakdown, ...extraBreakdown.map(b => ({ label: b.label, amount: b.amount }))],
    snapshot: {
      ...estimate.snapshot,
      total: newTotal,
      breakdown: extraBreakdown,
      parameters: {
        ...estimate.snapshot.parameters,
        ...extras
      }
    }
  };
}
