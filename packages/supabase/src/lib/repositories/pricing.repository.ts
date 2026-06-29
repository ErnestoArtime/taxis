import { SupabaseClient } from '@supabase/supabase-js';
import { PriceEstimateRequest } from '@taxi/domain';

export class PricingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listVehicleClasses(tenantId: string) {
    return this.supabase
      .from('vehicle_classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order');
  }

  async listTariffRules(tenantId: string) {
    return this.supabase
      .from('tariff_rules')
      .select('*, service_areas(name), vehicle_classes(name)')
      .eq('tenant_id', tenantId)
      .order('priority');
  }

  async estimate(request: PriceEstimateRequest) {
    return this.supabase.rpc('estimate_ride_price', {
      target_tenant_id: request.tenantId,
      target_service_area_id: request.serviceAreaId ?? null,
      target_vehicle_class_id: request.vehicleClassId ?? null,
      distance_km: request.distanceKm ?? 0,
      duration_minutes: request.durationMinutes ?? 0,
      pickup_at: request.pickupAt
    });
  }
}
