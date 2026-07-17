import { TenantBranding, TenantFeatureFlags } from '@taxi/domain';

export interface BrandingConfig {
  branding: TenantBranding;
  featureFlags: TenantFeatureFlags;
}

export function applyBrandingToDocument(config: BrandingConfig): void {
  const root = document.documentElement;

  root.style.setProperty('--taxi-primary-color', config.branding.primaryColor);
  root.style.setProperty('--taxi-accent-color', config.branding.accentColor);

  document.title = config.branding.name;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', config.branding.primaryColor);
  }
}

export function getBrandingCSSVariables(config: BrandingConfig): Record<string, string> {
  return {
    '--ion-color-primary': config.branding.primaryColor,
    '--ion-color-primary-shade': adjustColor(config.branding.primaryColor, -20),
    '--ion-color-primary-tint': adjustColor(config.branding.primaryColor, 20),
    '--ion-color-secondary': config.branding.accentColor,
    '--ion-color-secondary-shade': adjustColor(config.branding.accentColor, -20),
    '--ion-color-secondary-tint': adjustColor(config.branding.accentColor, 20)
  };
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round((percent / 100) * 255)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + Math.round((percent / 100) * 255)));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + Math.round((percent / 100) * 255)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
