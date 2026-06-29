export type TariffRuleKind = 'base' | 'distance' | 'time' | 'zone' | 'surge' | 'minimum';

export interface VehicleClass {
  id: string;
  tenantId: string;
  name: string;
  seats: number;
  isActive: boolean;
}

export interface TariffRule {
  id: string;
  tenantId: string;
  serviceAreaId?: string;
  vehicleClassId?: string;
  kind: TariffRuleKind;
  amount: number;
  currency: 'CUP' | 'USD' | 'EUR';
  priority: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
}

export interface PriceEstimateRequest {
  tenantId: string;
  serviceAreaId?: string;
  vehicleClassId?: string;
  distanceKm?: number;
  durationMinutes?: number;
  pickupAt: string;
}

export interface PriceEstimate {
  currency: 'CUP' | 'USD' | 'EUR';
  subtotal: number;
  minimumApplied: boolean;
  breakdown: Array<{
    label: string;
    amount: number;
  }>;
}
