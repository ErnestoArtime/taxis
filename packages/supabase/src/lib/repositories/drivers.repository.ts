import { SupabaseClient } from '@supabase/supabase-js';

export class DriversRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAvailable(tenantId: string) {
    return this.supabase
      .from('drivers')
      .select('*, profiles(display_name, phone), vehicles(id, plate, make, model)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('rating', { ascending: false });
  }

  async setAvailability(driverId: string, status: 'active' | 'paused') {
    return this.supabase
      .from('drivers')
      .update({ status })
      .eq('id', driverId)
      .select()
      .single();
  }
}
