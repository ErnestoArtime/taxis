import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { OperationsRepository, DriversRepository, NotificationsRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Despacho</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Asignacion de viajes</h1>

      <ion-list>
        <ion-item *ngFor="let ride of unassignedRides">
          <ion-label>
            <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
            <p>{{ ride.pickup_at | date:'short' }} - {{ ride.passenger_count }} pasajeros</p>
          </ion-label>
          <ion-badge color="warning">Pendiente</ion-badge>
        </ion-item>
      </ion-list>

      <ion-item *ngIf="unassignedRides.length > 0">
        <ion-select label="Chofer" labelPlacement="stacked" [(ngModel)]="selectedDriverId">
          <ion-select-option *ngFor="let driver of availableDrivers" [value]="driver.id">
            {{ driver.displayName }} - {{ driver.rating }} estrellas
          </ion-select-option>
        </ion-select>
      </ion-item>

      <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>

      <ion-button expand="block" (click)="assignDriver()" [disabled]="!selectedDriverId || loading">
        {{ loading ? 'Asignando...' : 'Asignar y notificar' }}
      </ion-button>
    </ion-content>
  `
})
export class DispatchPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private operationsRepo = inject(OperationsRepository);
  private driversRepo = inject(DriversRepository);
  private notificationsRepo = inject(NotificationsRepository);

  unassignedRides: RideRequest[] = [];
  availableDrivers: Array<{ id: string; displayName: string; rating: number }> = [];
  selectedDriverId = '';
  loading = false;
  error = '';

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }

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
        const profile = d['profiles'] as Record<string, unknown> | null;
        return {
          id: d['id'] as string,
          displayName: (profile?.['display_name'] as string) ?? 'Sin nombre',
          rating: d['rating'] as number
        };
      });
    }
  }

  async assignDriver(): Promise<void> {
    const tenantId = this.auth.tenantId;
    const actorId = this.auth.userId;
    const selectedRide = this.unassignedRides[0];

    if (!tenantId || !actorId || !selectedRide) {
      return;
    }

    this.loading = true;
    this.error = '';

    const vehicle = selectedRide.vehicle_id;

    const { error } = await this.operationsRepo.assignDriver({
      tenantId,
      rideRequestId: selectedRide.id,
      driverId: this.selectedDriverId,
      vehicleId: vehicle ?? undefined,
      actorId
    });

    if (error) {
      this.loading = false;
      this.error = error.message;
      return;
    }

    const client = this.auth.client;
    const { data: driverRecord } = await client
      .from('drivers')
      .select('profile_id')
      .eq('id', this.selectedDriverId)
      .single();

    if (driverRecord) {
      await this.notificationsRepo.notifyDriverAssigned(
        tenantId,
        driverRecord['profile_id'] as string,
        selectedRide.id,
        selectedRide.pickup_address
      );
    }

    this.loading = false;
    this.loadData();
  }
}
