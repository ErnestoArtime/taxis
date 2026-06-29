export type BookingStatus =
  | 'draft'
  | 'requested'
  | 'quoted'
  | 'confirmed'
  | 'driver_assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface BookingRequest {
  tenantId: string;
  customerId: string;
  serviceAreaId?: string;
  vehicleClassId?: string;
  pickupAddress: string;
  dropoffAddress?: string;
  pickupAt: string;
  passengerCount: number;
  estimatedDistanceKm?: number;
  estimatedDurationMinutes?: number;
  notes?: string;
}
