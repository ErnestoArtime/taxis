import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent,
  IonHeader, IonItem, IonLabel, IonList, IonTitle,
  IonToggle, IonToolbar, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { DriversRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe, NgIf, NgFor, FormsModule,
    IonBadge, IonButton, IonCard, IonCardContent, IonContent,
    IonHeader, IonItem, IonLabel, IonList, IonTitle,
    IonToggle, IonToolbar, IonSegment, IonSegmentButton, RouterLink
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Chofer</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="shift">
        <div>
          <h1>Turno</h1>
          <p>{{ driverProfile?.displayName }}</p>
        </div>
        <ion-toggle [checked]="isAvailable" (ionChange)="toggleAvailability($event)">Disponible</ion-toggle>
      </section>

      <ion-segment [(ngModel)]="tab">
        <ion-segment-button value="assigned">
          Mis viajes ({{ assignedRides.length }})
        </ion-segment-button>
        <ion-segment-button value="available" *ngIf="isAvailable">
          Disponibles ({{ availableRides.length }})
        </ion-segment-button>
      </ion-segment>

      <!-- Mis viajes asignados -->
      <ng-container *ngIf="tab === 'assigned'">
        <ion-card>
          <ion-card-content>
            <strong>Viajes activos</strong>
            <h2>{{ assignedRides.length }}</h2>
          </ion-card-content>
        </ion-card>

        <ion-list *ngIf="assignedRides.length > 0; else noAssigned">
          <ion-item *ngFor="let ride of assignedRides">
            <ion-label>
              <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
              <p>{{ ride.pickup_at | date:'short' }} - {{ ride.passenger_count }} pasajeros</p>
            </ion-label>
            <ion-badge [color]="getStatusColor(ride.status)">{{ ride.status }}</ion-badge>
            <ion-button fill="clear" [routerLink]="['/rides', ride.id]">Ver</ion-button>
          </ion-item>
        </ion-list>
        <ng-template #noAssigned>
          <p class="empty">Sin viajes asignados</p>
        </ng-template>
      </ng-container>

      <!-- Viajes disponibles para cotizar -->
      <ng-container *ngIf="tab === 'available'">
        <ion-list *ngIf="availableRides.length > 0; else noAvailable">
          <ion-item *ngFor="let ride of availableRides">
            <ion-label>
              <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
              <p>{{ ride.pickup_at | date:'short' }} - {{ ride.passenger_count }} pasajeros</p>
              <p class="note" *ngIf="ride.estimated_distance_km">~{{ ride.estimated_distance_km }} km</p>
            </ion-label>
            <ion-badge color="warning">{{ ride.status }}</ion-badge>
            <ion-button fill="clear" [routerLink]="['/rides', ride.id]">Cotizar</ion-button>
          </ion-item>
        </ion-list>
        <ng-template #noAvailable>
          <p class="empty">No hay viajes disponibles</p>
        </ng-template>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .shift { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .shift h1, .shift p, ion-card h2 { margin: 0; }
    .empty { text-align: center; color: var(--ion-color-medium); padding: 24px 0; }
    .note { font-size: 12px; color: var(--ion-color-medium); }
    ion-segment { margin-bottom: 12px; }
  `]
})
export class DashboardPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private driversRepo = inject(DriversRepository);

  driverProfile: { id: string; displayName: string; status: string } | null = null;
  assignedRides: RideRequest[] = [];
  availableRides: RideRequest[] = [];
  isAvailable = false;
  tab: 'assigned' | 'available' = 'assigned';

  ngOnInit(): void {
    this.loadProfile();
    this.loadRides();
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId) return;

    const client = this.auth.client;
    const { data: driverData } = await client
      .from('drivers')
      .select('id, profiles!inner(display_name)')
      .eq('tenant_id', tenantId)
      .eq('profile_id', userId)
      .single();

    if (!driverData) return;

    const profile = driverData['profiles'] as Record<string, unknown> | null;
    const driverId = driverData['id'] as string;

    const { data: presence } = await client
      .from('driver_presence')
      .select('is_online')
      .eq('driver_id', driverId)
      .single();

    this.driverProfile = {
      id: driverId,
      displayName: (profile?.['display_name'] as string) ?? 'Chofer',
      status: presence?.['is_online'] ? 'active' : 'paused'
    };
    this.isAvailable = presence?.['is_online'] ?? false;
  }

  private async loadRides(): Promise<void> {
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId) return;

    const client = this.auth.client;
    const { data: driverData } = await client
      .from('drivers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('profile_id', userId)
      .single();

    if (!driverData) return;
    const driverId = driverData['id'] as string;

    const [assignedResult, availableResult] = await Promise.all([
      client.from('ride_requests').select('*')
        .eq('driver_id', driverId)
        .in('status', ['driver_assigned', 'arriving', 'in_progress'])
        .order('pickup_at'),
      client.from('quoteable_rides').select('*')
        .eq('tenant_id', tenantId)
        .order('created_at')
    ]);

    if (assignedResult.data) {
      this.assignedRides = assignedResult.data as unknown as RideRequest[];
    }
    if (availableResult.data) {
      this.availableRides = availableResult.data as unknown as RideRequest[];
    }
  }

  async toggleAvailability(event: unknown): Promise<void> {
    const ev = event as { detail: { checked: boolean } };
    if (!this.auth.userId || !this.auth.tenantId || !this.driverProfile) return;

    const isOnline = ev.detail.checked;
    const newStatus = isOnline ? 'active' : 'paused';
    await this.driversRepo.setAvailability(this.driverProfile.id, newStatus as 'active' | 'paused', this.auth.tenantId);
    this.driverProfile.status = newStatus;
    this.isAvailable = isOnline;
    if (!isOnline) this.tab = 'assigned';
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      driver_assigned: 'success',
      arriving: 'success',
      in_progress: 'tertiary',
      requested: 'warning',
      quoted: 'warning'
    };
    return colors[status] ?? 'medium';
  }
}
