import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { TenantsRepository } from '@taxi/supabase';

@Component({
  standalone: true,
  imports: [NgIf, FormsModule, IonButton, IonCheckbox, IonContent, IonHeader, IonInput, IonItem, IonList, IonNote, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Configuracion</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Tenant y marca</h1>
      <ion-list>
        <ion-item>
          <ion-input label="Nombre comercial" labelPlacement="stacked" [(ngModel)]="branding.name"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Slug publico" labelPlacement="stacked" [(ngModel)]="branding.slug"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Telefono soporte" labelPlacement="stacked" [(ngModel)]="branding.supportPhone"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Color principal" labelPlacement="stacked" [(ngModel)]="branding.primaryColor"></ion-input>
        </ion-item>
      </ion-list>

      <h2>Funcionalidades</h2>
      <ion-list>
        <ion-item>
          <ion-checkbox [(ngModel)]="featureFlags.realtimeTracking">Seguimiento en tiempo real</ion-checkbox>
        </ion-item>
        <ion-item>
          <ion-checkbox [(ngModel)]="featureFlags.driverQuotes">Cotizaciones de choferes</ion-checkbox>
        </ion-item>
        <ion-item>
          <ion-checkbox [(ngModel)]="featureFlags.scheduledBookings">Reservas programadas</ion-checkbox>
        </ion-item>
        <ion-item>
          <ion-checkbox [(ngModel)]="featureFlags.promoCodes">Codigos promocionales</ion-checkbox>
        </ion-item>
        <ion-item>
          <ion-checkbox [(ngModel)]="featureFlags.whatsappNotifications">Notificaciones por WhatsApp</ion-checkbox>
        </ion-item>
      </ion-list>

      <ion-note *ngIf="saved" color="success">Configuracion guardada</ion-note>
      <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>
      <ion-button (click)="save()" [disabled]="loading">
        {{ loading ? 'Guardando...' : 'Guardar configuracion' }}
      </ion-button>
    </ion-content>
  `
})
export class SettingsPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private tenantsRepo = inject(TenantsRepository);

  branding = {
    name: '',
    slug: '',
    supportPhone: '',
    primaryColor: '#0f766e'
  };

  featureFlags = {
    realtimeTracking: true,
    driverQuotes: true,
    scheduledBookings: true,
    promoCodes: false,
    whatsappNotifications: true
  };

  loading = false;
  saved = false;
  error = '';

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }

    const { data: tenant } = await this.tenantsRepo.getById(tenantId);
    if (tenant) {
      this.branding = {
        name: tenant['name'] as string,
        slug: tenant['slug'] as string,
        supportPhone: (tenant['support_phone'] as string) ?? '',
        primaryColor: tenant['primary_color'] as string
      };
    }

    const client = this.auth.client;
    const { data: flags } = await client
      .from('tenant_feature_flags')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (flags) {
      this.featureFlags = {
        realtimeTracking: flags['realtime_tracking'] as boolean,
        driverQuotes: flags['driver_quotes'] as boolean,
        scheduledBookings: flags['scheduled_bookings'] as boolean,
        promoCodes: flags['promo_codes'] as boolean,
        whatsappNotifications: flags['whatsapp_notifications'] as boolean
      };
    }
  }

  async save(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }

    this.loading = true;
    this.saved = false;
    this.error = '';

    const { error } = await this.tenantsRepo.updateBranding(tenantId, {
      name: this.branding.name,
      slug: this.branding.slug,
      support_phone: this.branding.supportPhone,
      primary_color: this.branding.primaryColor
    });

    if (!error) {
      await this.saveFeatureFlags(tenantId);
    }

    this.loading = false;

    if (error) {
      this.error = error.message;
      return;
    }

    this.saved = true;
  }

  private async saveFeatureFlags(tenantId: string): Promise<void> {
    const client = this.auth.client;
    await client.from('tenant_feature_flags').upsert({
      tenant_id: tenantId,
      realtime_tracking: this.featureFlags.realtimeTracking,
      driver_quotes: this.featureFlags.driverQuotes,
      scheduled_bookings: this.featureFlags.scheduledBookings,
      promo_codes: this.featureFlags.promoCodes,
      whatsapp_notifications: this.featureFlags.whatsappNotifications
    }, { onConflict: 'tenant_id' });
  }
}
