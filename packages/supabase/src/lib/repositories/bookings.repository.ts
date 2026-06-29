import { SupabaseClient } from '@supabase/supabase-js';
import { BookingRequest } from '@taxi/domain';

export class BookingsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createRequest(request: BookingRequest) {
    return this.supabase.from('ride_requests').insert({
      tenant_id: request.tenantId,
      customer_id: request.customerId,
      service_area_id: request.serviceAreaId,
      vehicle_class_id: request.vehicleClassId,
      pickup_address: request.pickupAddress,
      dropoff_address: request.dropoffAddress,
      pickup_at: request.pickupAt,
      passenger_count: request.passengerCount,
      estimated_distance_km: request.estimatedDistanceKm,
      estimated_duration_minutes: request.estimatedDurationMinutes,
      notes: request.notes,
      status: 'requested'
    }).select().single();
  }

  async listForCustomer(customerId: string) {
    return this.supabase
      .from('ride_requests')
      .select('*, service_areas(name), vehicle_classes(name)')
      .eq('customer_id', customerId)
      .order('pickup_at', { ascending: false });
  }

  async confirmQuote(quoteId: string) {
    return this.supabase.rpc('confirm_ride_quote', {
      target_quote_id: quoteId
    });
  }
}
