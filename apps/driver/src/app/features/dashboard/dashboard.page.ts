import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToggle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { DriversRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToggle,
    IonToolbar,
    RouterLink
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

      <ion-card>
        <ion-card-content>
          <strong>Viajes asignados</strong>
          <h2>{{ assignedRides.length }}</h2>
        </ion-card-content>
      </ion-card>

      <ion-list>
        <ion-item *ngFor="let ride of assignedRides">
          <ion-label>
            <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
            <p>{{ ride.pickup_at | date:'short' }} - {{ ride.passenger_count }} pasajeros</p>
          </ion-label>
          <ion-badge [color]="getStatusColor(ride.status)">{{ ride.status }}</ion-badge>
          <ion-button fill="clear" [routerLink]="['/rides', ride.id]">Ver</ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .shift {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .shift h1,
    .shift p,
    ion-card h2 {
      margin: 0;
    }
  `]
})
export class DashboardPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private driversRepo = inject(DriversRepository);

  driverProfile: { id: string; displayName: string; status: string } | null = null;
  assignedRides: RideRequest[] = [];
  isAvailable = false;

  ngOnInit(): void {
    this.loadProfile();
    this.loadRides();
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId) {
      return;
    }

    const client = this.auth.client;
    const { data } = await client
      .from('drivers')
      .select('*, profiles!inner(display_name)')
      .eq('tenant_id', tenantId)
      .eq('profile_id', userId)
      .single();

    if (data) {
      const profile = data['profiles'] as Record<string, unknown> | null;
      this.driverProfile = {
        id: data['id'] as string,
        displayName: (profile?.['display_name'] as string) ?? 'Chofer',
        status: data['status'] as string
      };
      this.isAvailable = data['status'] === 'active';
    }
  }

  private async loadRides(): Promise<void> {
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId) {
      return;
    }

    const client = this.auth.client;
    const { data: driverData } = await client
      .from('drivers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('profile_id', userId)
      .single();

    if (!driverData) {
      return;
    }

    const { data } = await client
      .from('ride_requests')
      .select('*')
      .eq('driver_id', driverData['id'])
      .in('status', ['driver_assigned', 'arriving', 'in_progress'])
      .order('pickup_at');

    if (data) {
      this.assignedRides = data as unknown as RideRequest[];
    }
  }

  async toggleAvailability(event: unknown): Promise<void> {
    const ev = event as { detail: { checked: boolean } };
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId || !this.driverProfile) {
      return;
    }

    const newStatus = ev.detail.checked ? 'active' : 'paused';
    await this.driversRepo.setAvailability(this.driverProfile.id, newStatus as 'active' | 'paused');
    this.driverProfile.status = newStatus;
    this.isAvailable = ev.detail.checked;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      driver_assigned: 'success',
      arriving: 'success',
      in_progress: 'tertiary'
    };
    return colors[status] ?? 'medium';
  }
}
