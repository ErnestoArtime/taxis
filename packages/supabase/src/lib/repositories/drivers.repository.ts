import { SupabaseClient } from '@supabase/supabase-js';

export class DriversRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAvailable(tenantId: string) {
    return this.supabase
      .from('drivers')
      .select('*, profiles(display_name, phone), vehicles(id, plate, make, model), driver_presence!left(is_online)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('rating', { ascending: false });
  }

  async setAvailability(driverId: string, status: 'active' | 'paused', tenantId?: string) {
    const isOnline = status === 'active';
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const { data: driver } = await this.supabase
        .from('drivers')
        .select('tenant_id')
        .eq('id', driverId)
        .single();
      resolvedTenantId = driver?.['tenant_id'] as string | undefined;
    }
    return this.supabase
      .from('driver_presence')
      .upsert({
        driver_id: driverId,
        tenant_id: resolvedTenantId,
        is_online: isOnline,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'driver_id' })
      .select()
      .single();
  }

  async getPresence(driverId: string) {
    return this.supabase
      .from('driver_presence')
      .select('*')
      .eq('driver_id', driverId)
      .single();
  }
}
