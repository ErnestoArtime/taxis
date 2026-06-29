import { SupabaseClient } from '@supabase/supabase-js';

export function subscribeToRide(
  supabase: SupabaseClient,
  rideRequestId: string,
  onChange: (payload: unknown) => void
) {
  return supabase
    .channel(`ride:${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideRequestId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ride_events', filter: `ride_request_id=eq.${rideRequestId}` },
      onChange
    )
    .subscribe();
}

export function subscribeToTenantOperations(
  supabase: SupabaseClient,
  tenantId: string,
  onChange: (payload: unknown) => void
) {
  return supabase
    .channel(`tenant-operations:${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_requests', filter: `tenant_id=eq.${tenantId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drivers', filter: `tenant_id=eq.${tenantId}` },
      onChange
    )
    .subscribe();
}
