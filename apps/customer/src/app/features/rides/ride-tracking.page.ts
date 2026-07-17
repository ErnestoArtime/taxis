import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonTextarea, IonTitle, IonToolbar, IonIcon
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { subscribeToRide } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';
import { isOngoingStatus, canCancel } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe, IonBadge, IonButton, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonTextarea, IonTitle, IonToolbar, IonIcon
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Seguimiento</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="map-shell">
        <div class="route-line"></div>
        <span class="pin pickup"></span>
        <span class="pin dropoff"></span>
        <span class="car" *ngIf="ride && isOngoing(ride.status)">Taxi</span>
      </section>

      <section class="status-banner" *ngIf="ride" [class]="'status-' + ride.status">
        <strong>{{ statusLabel }}</strong>
      </section>

      <ion-list *ngIf="ride">
        <ion-item>
          <ion-label>
            <h2>{{ ride.pickup_address }}</h2>
            <p>{{ ride.dropoff_address ?? 'Sin destino' }}</p>
          </ion-label>
          <ion-badge [color]="getStatusColor(ride.status)">{{ statusLabel }}</ion-badge>
        </ion-item>

        <ion-item *ngIf="ride.driver_id && driverInfo">
          <ion-label>
            <h2>Chofer</h2>
            <p>{{ driverInfo.displayName }} · {{ driverInfo.vehiclePlate }}</p>
            <p>{{ driverInfo.vehicleMake }} {{ driverInfo.vehicleModel }}</p>
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

        <ion-item>
          <ion-label>
            <h2>Fecha</h2>
            <p>{{ ride.pickup_at | date:'medium' }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" color="danger" *ngIf="ride && canCancelRide()" (click)="cancelRide()">
        Cancelar viaje
      </ion-button>

      <ng-container *ngIf="ride?.status === 'completed'">
        <ion-item>
          <ion-label position="stacked">Califica tu viaje (1-5)</ion-label>
          <div class="stars">
            <ion-button *ngFor="let s of [1,2,3,4,5]" fill="clear" (click)="rateRide(s)">
              {{ s <= rating ? '★' : '☆' }}
            </ion-button>
          </div>
        </ion-item>
        <ion-item>
          <ion-textarea label="Comentario" labelPlacement="stacked" [(ngModel)]="reviewComment"></ion-textarea>
        </ion-item>
        <ion-button expand="block" (click)="submitReview()" [disabled]="rating === 0">
          Enviar calificacion
        </ion-button>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .map-shell {
      position: relative; min-height: 220px; margin-bottom: 16px;
      overflow: hidden; border-radius: 8px;
      background:
        linear-gradient(90deg, rgba(15, 118, 110, 0.12) 1px, transparent 1px),
        linear-gradient(rgba(15, 118, 110, 0.12) 1px, transparent 1px), #f8fafc;
      background-size: 32px 32px;
    }
    .route-line {
      position: absolute; inset: 62px 58px 72px 48px;
      border: 4px solid var(--ion-color-primary);
      border-left: 0; border-bottom: 0; border-radius: 0 42px 0 0;
    }
    .pin, .car {
      position: absolute; display: grid; place-items: center;
      width: 42px; height: 42px; border-radius: 50%; font-size: 12px; font-weight: 700;
    }
    .pickup { left: 32px; bottom: 48px; background: var(--ion-color-secondary); }
    .dropoff { right: 44px; top: 42px; background: var(--ion-color-primary); }
    .car {
      right: 112px; top: 52px; width: 54px; border-radius: 999px;
      background: #111827; color: #fff;
    }
    .status-banner {
      padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;
    }
    .status-banner.status-completed { background: #d1fae5; color: #065f46; }
    .status-banner.status-cancelled { background: #fee2e2; color: #991b1b; }
    .status-banner.status-in_progress { background: #dbeafe; color: #1e40af; }
    .status-banner.status-driver_assigned, .status-banner.status-arriving { background: #fef3c7; color: #92400e; }
    .stars { display: flex; gap: 4px; }
  `]
})
export class RideTrackingPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(TaxiAuthService);

  ride: RideRequest | null = null;
  driverInfo: { displayName: string; vehiclePlate: string; vehicleMake: string; vehicleModel: string } | null = null;
  rating = 0;
  reviewComment = '';
  private channel: ReturnType<typeof subscribeToRide> | null = null;

  get statusLabel(): string {
    if (!this.ride) return '';
    const labels: Record<string, string> = {
      requested: 'Solicitado', quoted: 'Cotizado', confirmed: 'Confirmado',
      driver_assigned: 'Chofer asignado', arriving: 'Chofer en camino',
      in_progress: 'Viaje en curso', completed: 'Completado', cancelled: 'Cancelado'
    };
    return labels[this.ride.status] ?? this.ride.status;
  }

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
      .select('*, drivers!inner(id, profile_id, vehicles(id, plate, make, model))')
      .eq('id', id)
      .single();

    if (data) {
      this.ride = data as unknown as RideRequest;
      if (data['driver_id']) {
        const driver = data['drivers'] as Record<string, unknown> | undefined;
        if (driver) {
          const profile = await this.loadProfile(driver['profile_id'] as string);
          const vehicle = driver['vehicles'] as Record<string, unknown> | undefined;
          this.driverInfo = {
            displayName: profile?.displayName ?? 'Chofer',
            vehiclePlate: (vehicle?.['plate'] as string) ?? '',
            vehicleMake: (vehicle?.['make'] as string) ?? '',
            vehicleModel: (vehicle?.['model'] as string) ?? ''
          };
        }
      }
    }
  }

  private async loadProfile(profileId: string): Promise<{ displayName: string } | null> {
    const client = this.auth.client;
    const { data } = await client.from('profiles').select('display_name').eq('id', profileId).single();
    return data ? { displayName: data['display_name'] as string } : null;
  }

  private subscribeToChanges(id: string): void {
    const client = this.auth.client;
    this.channel = subscribeToRide(client, id, () => this.loadRide(id));
  }

  isOngoing(status: string): boolean {
    return isOngoingStatus(status as Parameters<typeof isOngoingStatus>[0]);
  }

  canCancelRide(): boolean {
    if (!this.ride) return false;
    return canCancel('customer', this.ride.status as Parameters<typeof canCancel>[1]);
  }

  async cancelRide(): Promise<void> {
    if (!this.ride) return;
    const client = this.auth.client;
    const userId = this.auth.userId;
    await client.rpc('transition_ride_state', {
      target_ride_request_id: this.ride.id,
      new_status: 'cancelled',
      actor_profile_id: userId,
      event_payload: { reason: 'cancelado por cliente' }
    });
    this.loadRide(this.ride.id);
  }

  async rateRide(stars: number): Promise<void> {
    this.rating = stars;
  }

  async submitReview(): Promise<void> {
    if (!this.ride || this.rating === 0) return;
    const client = this.auth.client;
    const userId = this.auth.userId;

    const { data: driverData } = await client
      .from('ride_requests')
      .select('driver_id')
      .eq('id', this.ride.id)
      .single();

    await client.from('reviews').insert({
      tenant_id: this.ride.tenant_id,
      ride_request_id: this.ride.id,
      reviewer_id: userId,
      driver_id: driverData?.['driver_id'] ?? null,
      rating: this.rating,
      comment: this.reviewComment || null
    });
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      requested: 'warning', quoted: 'warning', confirmed: 'primary',
      driver_assigned: 'success', arriving: 'success', in_progress: 'tertiary',
      completed: 'medium', cancelled: 'danger'
    };
    return colors[status] ?? 'medium';
  }
}
