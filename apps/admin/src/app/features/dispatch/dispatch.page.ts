import { Component, inject, OnInit } from '@angular/core';
import { DatePipe, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonNote, IonRadio, IonRadioGroup, IonSelect, IonSelectOption,
  IonTitle, IonToolbar, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { OperationsRepository, DriversRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';
import { type NearbyDriver } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe, NgIf, NgFor, FormsModule, IonBadge, IonButton, IonContent, IonHeader,
    IonItem, IonLabel, IonList, IonNote, IonRadio, IonRadioGroup,
    IonSelect, IonSelectOption, IonTitle, IonToolbar, IonSegment, IonSegmentButton
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Despacho</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-segment [(ngModel)]="mode">
        <ion-segment-button value="manual">Manual</ion-segment-button>
        <ion-segment-button value="auto">Auto-asignar</ion-segment-button>
      </ion-segment>

      <!-- Manual mode -->
      <ng-container *ngIf="mode === 'manual'">
        <h1>Asignacion manual</h1>

        <ion-list *ngIf="unassignedRides.length > 0; else noRides">
          <ion-radio-group [(ngModel)]="selectedRideId">
            <ion-item *ngFor="let ride of unassignedRides">
              <ion-radio [value]="ride.id" slot="start"></ion-radio>
              <ion-label>
                <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
                <p>{{ ride.pickup_at | date:'short' }} - {{ ride.passenger_count }} pasajeros</p>
              </ion-label>
              <ion-badge color="warning">Pendiente</ion-badge>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <ng-template #noRides>
          <p class="empty">No hay viajes pendientes</p>
        </ng-template>

        <ion-item *ngIf="unassignedRides.length > 0 && selectedRideId">
          <ion-select label="Chofer" labelPlacement="stacked" [(ngModel)]="selectedDriverId">
            <ion-select-option *ngFor="let driver of availableDrivers" [value]="driver.id">
              {{ driver.displayName }} - {{ driver.rating }} estrellas
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>

        <ion-button expand="block" (click)="assignDriver()"
          [disabled]="!selectedRideId || !selectedDriverId || loading">
          {{ loading ? 'Asignando...' : 'Asignar y notificar' }}
        </ion-button>
      </ng-container>

      <!-- Auto mode -->
      <ng-container *ngIf="mode === 'auto'">
        <h1>Auto-asignacion por proximidad</h1>

        <ion-list *ngIf="unassignedRides.length > 0; else noAutoRides">
          <ion-radio-group [(ngModel)]="selectedRideId">
            <ion-item *ngFor="let ride of unassignedRides">
              <ion-radio [value]="ride.id" slot="start"></ion-radio>
              <ion-label>
                <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
                <p>{{ ride.pickup_at | date:'short' }}</p>
              </ion-label>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <ng-template #noAutoRides>
          <p class="empty">No hay viajes para auto-asignar</p>
        </ng-template>

        <ion-list *ngIf="nearbyDrivers.length > 0">
          <ion-item *ngFor="let d of nearbyDrivers">
            <ion-label>
              <h2>{{ d.displayName }}</h2>
              <p>{{ d.distanceKm }} km · {{ d.rating }} estrellas · {{ d.vehiclePlate || 'Sin vehiculo' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>
        <ion-note *ngIf="autoResult" color="success">{{ autoResult }}</ion-note>

        <ion-button expand="block" (click)="autoAssign()"
          [disabled]="!selectedRideId || autoLoading" color="success">
          {{ autoLoading ? 'Buscando chofer...' : 'Auto-asignar mejor chofer' }}
        </ion-button>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .empty { text-align: center; color: var(--ion-color-medium); padding: 32px 0; }
  `]
})
export class DispatchPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private operationsRepo = inject(OperationsRepository);
  private driversRepo = inject(DriversRepository);

  mode: 'manual' | 'auto' = 'manual';
  unassignedRides: RideRequest[] = [];
  availableDrivers: Array<{ id: string; displayName: string; rating: number }> = [];
  nearbyDrivers: NearbyDriver[] = [];
  selectedRideId = '';
  selectedDriverId = '';
  loading = false;
  autoLoading = false;
  error = '';
  autoResult = '';

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) return;

    const [ridesResult, driversResult] = await Promise.all([
      this.operationsRepo.listOpenRides(tenantId),
      this.driversRepo.listAvailable(tenantId)
    ]);

    if (ridesResult.data) {
      this.unassignedRides = (ridesResult.data as unknown as RideRequest[])
        .filter(r => r.status === 'requested');
    }

    if (driversResult.data) {
      this.availableDrivers = (driversResult.data as Array<Record<string, unknown>>).map(d => {
        return {
          id: d['driver_id'] as string,
          displayName: (d['display_name'] as string) ?? 'Sin nombre',
          rating: d['rating'] as number
        };
      });
    }
  }

  async assignDriver(): Promise<void> {
    const tenantId = this.auth.tenantId;
    const actorId = this.auth.userId;

    if (!tenantId || !actorId || !this.selectedRideId || !this.selectedDriverId) {
      this.error = 'Selecciona un viaje y un chofer.';
      return;
    }

    this.loading = true;
    this.error = '';

    const { error } = await this.operationsRepo.assignDriver({
      tenantId, rideRequestId: this.selectedRideId,
      driverId: this.selectedDriverId, actorId
    });

    if (error) {
      this.loading = false;
      this.error = error.message;
      return;
    }

    this.loading = false;
    this.selectedRideId = '';
    this.selectedDriverId = '';
    this.loadData();
  }

  async autoAssign(): Promise<void> {
    const userId = this.auth.userId;
    if (!this.selectedRideId || !userId) return;

    this.autoLoading = true;
    this.error = '';
    this.autoResult = '';
    this.nearbyDrivers = [];

    const client = this.auth.client;
    const { data, error } = await client.rpc('auto_assign_driver', {
      target_ride_request_id: this.selectedRideId,
      actor_profile_id: null
    });

    this.autoLoading = false;

    if (error) {
      this.error = error.message;
      return;
    }

    const result = data as Record<string, unknown>;
    if (result['success']) {
      this.autoResult = `Chofer asignado: ${result['driver_name']} (${result['distance_km']} km, ${result['vehicle_plate'] || 'sin vehiculo'})`;
      this.selectedRideId = '';
      this.loadData();
    } else {
      this.error = (result['error'] as string) ?? 'Error al auto-asignar';
    }
  }
}
