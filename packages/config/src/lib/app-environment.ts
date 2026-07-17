export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  tenantSlug: string;
  mapProvider: 'leaflet' | 'mapbox' | 'google';
  mapApiKey?: string;
  pushProvider?: 'fcm' | 'apns';
  fcmServerKey?: string;
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
