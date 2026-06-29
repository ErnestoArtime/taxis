export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  tenantSlug?: string;
}
