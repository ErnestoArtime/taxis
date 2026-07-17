export interface NearbyDriver {
  driverId: string;
  profileId: string;
  displayName: string;
  phone?: string;
  vehiclePlate?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  heading?: number;
  rating: number;
}

export interface AutoAssignResult {
  success: boolean;
  error?: string;
  driverId?: string;
  driverName?: string;
  distanceKm?: number;
  vehiclePlate?: string;
}

export interface QuoteSubmission {
  rideRequestId: string;
  price: number;
  currency: string;
  driverId?: string;
}

export interface DriverPerformance {
  driverId: string;
  tenantId: string;
  displayName: string;
  rating: number;
  completedRides: number;
  ridesLast7Days: number;
  revenueLast7Days: number;
  completionRate: number;
}

export interface DailyMetrics {
  date: string;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  avgFare: number;
  revenue: number;
  activeDrivers: number;
  avgRideDurationMinutes: number;
}

export function selectBestDriver(drivers: NearbyDriver[], preferences?: {
  preferHigherRated?: boolean;
  preferCloser?: boolean;
}): NearbyDriver | null {
  if (drivers.length === 0) return null;

  if (preferences?.preferHigherRated) {
    return drivers.reduce((best, d) => d.rating > best.rating ? d : best);
  }

  return drivers.reduce((best, d) => d.distanceKm < best.distanceKm ? d : best);
}

export function shouldAutoAssign(
  rideCreatedAt: Date,
  config: {
    autoAssignEnabled: boolean;
    maxWaitMinutes: number;
    driverQuotesEnabled: boolean;
  }
): boolean {
  if (!config.autoAssignEnabled) return false;
  if (config.driverQuotesEnabled) {
    // Wait for quotes before auto-assigning
    const elapsed = (Date.now() - rideCreatedAt.getTime()) / 60000;
    return elapsed > config.maxWaitMinutes;
  }
  return true;
}
