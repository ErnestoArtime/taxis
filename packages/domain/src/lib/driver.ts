export type DriverStatus = 'pending' | 'active' | 'paused' | 'blocked';

export interface DriverProfile {
  id: string;
  tenantId: string;
  displayName: string;
  phone: string;
  status: DriverStatus;
  currentVehicleId?: string;
  rating?: number;
}
