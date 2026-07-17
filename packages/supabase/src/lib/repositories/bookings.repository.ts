import { SupabaseClient } from '@supabase/supabase-js';
import { BookingRequest } from '@taxi/domain';

export class BookingsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createRequest(request: BookingRequest & { estimatedPrice?: number; pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number }) {
    return this.supabase.rpc('create_ride_request', {
      p_tenant_id: request.tenantId,
      p_customer_id: request.customerId,
      p_pickup_address: request.pickupAddress,
      p_dropoff_address: request.dropoffAddress ?? null,
      p_pickup_at: request.pickupAt,
      p_passenger_count: request.passengerCount,
      p_estimated_distance_km: request.estimatedDistanceKm ?? null,
      p_estimated_duration_minutes: request.estimatedDurationMinutes ?? null,
      p_estimated_price: request.estimatedPrice ?? null,
      p_service_area_id: request.serviceAreaId ?? null,
      p_vehicle_class_id: request.vehicleClassId ?? null,
      p_passenger_name: null,
      p_passenger_phone: null,
      p_notes: request.notes ?? null
    });
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
