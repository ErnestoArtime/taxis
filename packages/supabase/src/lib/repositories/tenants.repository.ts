import { SupabaseClient } from '@supabase/supabase-js';

export class TenantsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getBrandingBySlug(slug: string) {
    return this.supabase
      .from('tenant_public_config')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
  }

  async getById(tenantId: string) {
    return this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();
  }

  async updateBranding(tenantId: string, patch: Record<string, unknown>) {
    return this.supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select()
      .single();
  }
}
