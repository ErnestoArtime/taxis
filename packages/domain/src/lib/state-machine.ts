export const RIDE_STATUSES = [
  'requested',
  'quoted',
  'confirmed',
  'driver_assigned',
  'arriving',
  'in_progress',
  'completed',
  'cancelled'
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  requested: ['quoted', 'confirmed', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  confirmed: ['driver_assigned', 'cancelled'],
  driver_assigned: ['arriving', 'confirmed', 'cancelled'],
  arriving: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: []
};

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStates(current: RideStatus): RideStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function isActiveStatus(status: RideStatus): boolean {
  return !['completed', 'cancelled'].includes(status);
}

export function isOngoingStatus(status: RideStatus): boolean {
  return ['driver_assigned', 'arriving', 'in_progress'].includes(status);
}

export type CancellationActor = 'customer' | 'driver' | 'tenant_admin' | 'platform_admin';

export const CANCELLATION_ALLOWED_FROM: Record<CancellationActor, RideStatus[]> = {
  customer: ['requested', 'quoted', 'confirmed'],
  driver: ['driver_assigned', 'arriving'],
  tenant_admin: ['requested', 'quoted', 'confirmed', 'driver_assigned', 'arriving', 'in_progress'],
  platform_admin: ['requested', 'quoted', 'confirmed', 'driver_assigned', 'arriving', 'in_progress']
};

export function canCancel(actor: CancellationActor, currentStatus: RideStatus): boolean {
  return CANCELLATION_ALLOWED_FROM[actor]?.includes(currentStatus) ?? false;
}
