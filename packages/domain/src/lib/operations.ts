export interface OperationsSummary {
  tenantId: string;
  pendingRides: number;
  activeRides: number;
  completedToday: number;
  availableDrivers: number;
  revenueToday: number;
}

export interface DriverAssignmentRequest {
  tenantId: string;
  rideRequestId: string;
  driverId: string;
  vehicleId?: string;
  actorId: string;
}
