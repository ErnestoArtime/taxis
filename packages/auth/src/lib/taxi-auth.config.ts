import { InjectionToken } from '@angular/core';

export interface TaxiAuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  tenantSlug: string;
}

export const TAXI_AUTH_CONFIG = new InjectionToken<TaxiAuthConfig>('TAXI_AUTH_CONFIG');
