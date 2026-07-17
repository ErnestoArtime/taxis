import { AppEnvironment } from '@taxi/config';

export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: 'http://localhost:54321',
  supabasePublishableKey: 'your-anon-key-here',
  tenantSlug: 'habana-taxi',
  mapProvider: 'leaflet',
  logLevel: 'info'
};
