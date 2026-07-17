import { SupabaseClient } from '@supabase/supabase-js';
import { DriverAssignmentRequest } from '@taxi/domain';

export class OperationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSummary(tenantId: string) {
    return this.supabase
      .from('tenant_operations_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
  }

  async listOpenRides(tenantId: string) {
    return this.supabase
      .from('ride_requests')
      .select('*, service_areas(name), drivers(id, profiles(display_name)), vehicles(plate)')
      .eq('tenant_id', tenantId)
      .in('status', ['requested', 'quoted', 'confirmed', 'driver_assigned', 'arriving', 'in_progress'])
      .order('pickup_at');
  }

  async assignDriver(request: DriverAssignmentRequest) {
    return this.supabase.rpc('transition_ride_state', {
      target_ride_request_id: request.rideRequestId,
      new_status: 'driver_assigned',
      actor_profile_id: null,
      event_payload: { driver_id: request.driverId }
    });
  }
}
