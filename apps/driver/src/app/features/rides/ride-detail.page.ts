import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { subscribeToRide } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';
import { getNextStates, isActiveStatus, canTransition } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [FormsModule, IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonTitle, IonToolbar],
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
            <p *ngIf="ride.pickup_reference" class="note">{{ ride.pickup_reference }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Destino</h2>
            <p>{{ ride.dropoff_address ?? 'Sin destino' }}</p>
          </ion-label>
        </ion-item>
        <ion-item *ngIf="ride.passenger_name">
          <ion-label>
            <h2>Pasajero</h2>
            <p>{{ ride.passenger_name }}</p>
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
            <h2>Precio</h2>
            <p>{{ ride.final_price ? 'CUP ' + ride.final_price : (ride.estimated_price ? 'CUP ' + ride.estimated_price + ' (estimado)' : 'Por confirmar') }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- Quote form for requested rides -->
      <ion-item *ngIf="ride?.status === 'requested' || ride?.status === 'quoted'">
        <ion-input label="Tu oferta (CUP)" labelPlacement="stacked" type="number" [(ngModel)]="quotePrice" placeholder="Precio sugerido"></ion-input>
      </ion-item>
      <ion-button expand="block" color="secondary" *ngIf="ride?.status === 'requested' || ride?.status === 'quoted'"
        (click)="submitQuote()" [disabled]="!quotePrice || quoteLoading">
        {{ quoteLoading ? 'Enviando...' : 'Enviar cotizacion' }}
      </ion-button>

      <section class="actions" *ngIf="ride && ride.status !== 'completed' && ride.status !== 'cancelled'">
        <ion-button expand="block" color="success" *ngIf="showAction('arriving')" (click)="transition('arriving')">
          En camino
        </ion-button>
        <ion-button expand="block" color="primary" *ngIf="showAction('in_progress')" (click)="transition('in_progress')">
          Pasajero abordo
        </ion-button>
        <ion-button expand="block" color="tertiary" *ngIf="showAction('completed')" (click)="transition('completed')">
          Viaje completado
        </ion-button>
        <ion-button expand="block" color="danger" *ngIf="showAction('cancelled')" (click)="transition('cancelled')">
          Cancelar viaje
        </ion-button>
      </section>
    </ion-content>
  `,
  styles: [`
    .actions { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; }
    .note { font-size: 12px; color: var(--ion-color-medium); }
  `]
})
export class RideDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(TaxiAuthService);

  ride: RideRequest | null = null;
  quotePrice: number | null = null;
  quoteLoading = false;
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
    }
  }

  private subscribeToChanges(id: string): void {
    const client = this.auth.client;
    this.channel = subscribeToRide(client, id, () => this.loadRide(id));
  }

  showAction(targetStatus: string): boolean {
    if (!this.ride) return false;
    const fromStatus = this.ride.status as Parameters<typeof canTransition>[0];
    const toStatus = targetStatus as Parameters<typeof canTransition>[1];
    return canTransition(fromStatus, toStatus);
  }

  async submitQuote(): Promise<void> {
    if (!this.ride || !this.quotePrice) return;
    this.quoteLoading = true;
    const client = this.auth.client;
    const { error } = await client.rpc('submit_driver_quote', {
      target_ride_request_id: this.ride.id,
      quoted_price: this.quotePrice
    });
    this.quoteLoading = false;
    if (!error) {
      this.quotePrice = null;
    }
  }

  async transition(newStatus: string): Promise<void> {
    if (!this.ride) return;
    const client = this.auth.client;
    const eventPayload: Record<string, unknown> = {};
    if (newStatus === 'cancelled') {
      eventPayload['cancellation_note'] = 'Cancelado por el chofer';
    }
    const { error } = await client.rpc('transition_ride_state', {
      target_ride_request_id: this.ride.id,
      new_status: newStatus,
      actor_profile_id: null,
      event_payload: eventPayload
    });

    if (error) {
      console.error('Error al cambiar estado:', error.message);
      return;
    }

    this.loadRide(this.ride.id);
  }
}
