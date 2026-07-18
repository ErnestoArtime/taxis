import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
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
import { BookingsRepository, PricingRepository } from '@taxi/supabase';
import { NominatimMapProvider } from '@taxi/maps';
import type { PriceEstimate } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
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
        <ion-title>Nueva reserva</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Datos del viaje</h1>
      <ion-list>
        <ion-item>
          <ion-input label="Origen" labelPlacement="stacked" [(ngModel)]="pickupAddress" placeholder="Direccion de recogida"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Destino" labelPlacement="stacked" [(ngModel)]="dropoffAddress" placeholder="Direccion de destino"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Fecha y hora" labelPlacement="stacked" type="datetime-local" [(ngModel)]="pickupAt"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Pasajeros" labelPlacement="stacked" type="number" [(ngModel)]="passengerCount" min="1"></ion-input>
        </ion-item>
        <ion-item>
          <ion-select label="Tipo de vehiculo" labelPlacement="stacked" [(ngModel)]="vehicleClassId" (ionChange)="estimatePrice()">
            <ion-select-option *ngFor="let vc of vehicleClasses" [value]="vc.id">
              {{ vc.name }} ({{ vc.seats }} asientos)
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input label="Distancia aprox. (km)" labelPlacement="stacked" type="number" [(ngModel)]="distanceKm" (ionChange)="estimatePrice()" placeholder="0"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Duracion aprox. (min)" labelPlacement="stacked" type="number" [(ngModel)]="durationMin" (ionChange)="estimatePrice()" placeholder="0"></ion-input>
        </ion-item>
      </ion-list>

      <section class="estimate" *ngIf="estimate">
        <ion-label>
          <h2>Estimado</h2>
          <p *ngFor="let item of estimate.breakdown">{{ item.label }}: {{ estimate.currency }} {{ item.amount }}</p>
        </ion-label>
        <strong>{{ estimate.currency }} {{ estimate.subtotal }}</strong>
      </section>

      <ion-note>La tarifa final puede ser confirmada por el operador o por cotizacion del chofer.</ion-note>
      <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>
      <ion-button expand="block" (click)="createBooking()" [disabled]="loading || !pickupAddress">
        {{ loading ? 'Creando...' : 'Solicitar reserva' }}
      </ion-button>
    </ion-content>
  `,
  styles: [`
    .estimate {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 18px 0;
      padding: 16px;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 8px;
    }

    .estimate h2,
    .estimate p {
      margin: 0;
    }
  `]
})
export class NewBookingPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private router = inject(Router);
  private bookingsRepo = inject(BookingsRepository);
  private pricingRepo = inject(PricingRepository);
  private mapsProvider = new NominatimMapProvider();

  pickupAddress = '';
  dropoffAddress = '';
  pickupAt = '';
  passengerCount = 1;
  vehicleClassId = '';
  distanceKm: number | null = null;
  durationMin: number | null = null;
  vehicleClasses: Array<{ id: string; name: string; seats: number }> = [];
  estimate: PriceEstimate | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.loadVehicleClasses();
  }

  private async loadVehicleClasses(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }
    const { data } = await this.pricingRepo.listVehicleClasses(tenantId);
    if (data) {
      this.vehicleClasses = data.map((vc: Record<string, unknown>) => ({
        id: vc['id'] as string,
        name: vc['name'] as string,
        seats: vc['seats'] as number
      }));
    }
  }

  async estimatePrice(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId || !this.pickupAddress) {
      return;
    }

    const { data } = await this.pricingRepo.estimate({
      tenantId,
      vehicleClassId: this.vehicleClassId || undefined,
      distanceKm: this.distanceKm ?? undefined,
      durationMinutes: this.durationMin ?? undefined,
      pickupAt: this.pickupAt || new Date().toISOString()
    });

    if (data) {
      this.estimate = data as PriceEstimate;
    }
  }

  async createBooking(): Promise<void> {
    const userId = this.auth.userId;
    const tenantId = this.auth.tenantId;
    if (!userId || !tenantId) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.loading = true;
    this.error = '';

    const [pickupPlace, dropoffPlace] = await Promise.all([
      this.pickupAddress ? this.mapsProvider.geocode(this.pickupAddress) : null,
      this.dropoffAddress ? this.mapsProvider.geocode(this.dropoffAddress) : null
    ]);

    const pickupLat = pickupPlace?.coordinates.lat;
    const pickupLng = pickupPlace?.coordinates.lng;
    const dropoffLat = dropoffPlace?.coordinates.lat;
    const dropoffLng = dropoffPlace?.coordinates.lng;

    let distanceKm = this.distanceKm ?? undefined;
    let durationMin = this.durationMin ?? undefined;

    if (!distanceKm && pickupPlace?.coordinates && dropoffPlace?.coordinates) {
      distanceKm = await this.mapsProvider.getDistanceKm(
        pickupPlace.coordinates,
        dropoffPlace.coordinates
      );
      durationMin = await this.mapsProvider.getDurationMinutes(
        pickupPlace.coordinates,
        dropoffPlace.coordinates
      );
    }

    const estimatedPrice = this.estimate?.subtotal
      ?? (distanceKm ? Math.round((10 + distanceKm * 5 + (durationMin ?? 0) * 0.5) * 100) / 100 : undefined);

    const { data, error } = await this.bookingsRepo.createRequest({
      tenantId,
      customerId: userId,
      vehicleClassId: this.vehicleClassId || undefined,
      pickupAddress: this.pickupAddress,
      dropoffAddress: this.dropoffAddress || undefined,
      pickupAt: this.pickupAt || new Date().toISOString(),
      passengerCount: this.passengerCount,
      estimatedDistanceKm: distanceKm,
      estimatedDurationMinutes: durationMin,
      estimatedPrice,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      notes: `${this.pickupAddress} → ${this.dropoffAddress || 'Sin destino'}`
    });

    this.loading = false;

    if (error) {
      this.error = error.message;
      return;
    }

    if (data) {
      this.router.navigateByUrl(`/rides/${data['id']}`);
    }
  }
}
