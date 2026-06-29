export interface TenantBranding {
  tenantId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  currency: 'CUP' | 'USD' | 'EUR';
  locale?: string;
  supportPhone?: string;
  supportWhatsapp?: string;
}

export interface TenantFeatureFlags {
  tenantId: string;
  realtimeTracking: boolean;
  driverQuotes: boolean;
  scheduledBookings: boolean;
  promoCodes: boolean;
  whatsappNotifications: boolean;
}
