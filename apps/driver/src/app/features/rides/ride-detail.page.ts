import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { subscribeToRide } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Viaje</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Detalle del servicio</h1>

      <ion-list *ngIf="ride">
        <ion-item>
          <ion-label>
            <h2>Origen</h2>
            <p>{{ ride.pickup_address }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Destino</h2>
            <p>{{ ride.dropoff_address ?? 'Sin destino' }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Pasajeros</h2>
            <p>{{ ride.passenger_count }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Estimado</h2>
            <p>{{ ride.estimated_price ? 'CUP ' + ride.estimated_price : 'Pendiente' }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-segment [value]="selectedStatus" (ionChange)="updateSegment($event)">
        <ion-segment-button value="driver_assigned">Asignado</ion-segment-button>
        <ion-segment-button value="arriving">Llegando</ion-segment-button>
        <ion-segment-button value="in_progress">En viaje</ion-segment-button>
        <ion-segment-button value="completed">Completado</ion-segment-button>
      </ion-segment>

      <ion-button expand="block" (click)="updateCurrentStatus()">Actualizar estado</ion-button>
    </ion-content>
  `
})
export class RideDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(TaxiAuthService);

  ride: RideRequest | null = null;
  selectedStatus = 'driver_assigned';
  private channel: ReturnType<typeof subscribeToRide> | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadRide(id);
    this.subscribeToChanges(id);
  }

  ngOnDestroy(): void {
    this.channel?.unsubscribe();
  }

  private async loadRide(id: string): Promise<void> {
    const client = this.auth.client;
    const { data } = await client
      .from('ride_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      this.ride = data as unknown as RideRequest;
      this.selectedStatus = data['status'] as string;
    }
  }

  private subscribeToChanges(id: string): void {
    const client = this.auth.client;
    this.channel = subscribeToRide(client, id, () => {
      this.loadRide(id);
    });
  }

  updateSegment(event: unknown): void {
    const ev = event as { detail: { value: string } };
    this.selectedStatus = ev.detail.value;
  }

  async updateCurrentStatus(): Promise<void> {
    if (!this.ride) {
      return;
    }

    const client = this.auth.client;
    await client
      .from('ride_requests')
      .update({ status: this.selectedStatus })
      .eq('id', this.ride.id);

    const actorId = this.auth.userId;
    if (actorId) {
      await client.from('ride_events').insert({
        tenant_id: this.ride.tenant_id,
        ride_request_id: this.ride.id,
        actor_id: actorId,
        event_type: this.selectedStatus,
        payload: { status: this.selectedStatus }
      });
    }

    this.loadRide(this.ride.id);
  }
}
