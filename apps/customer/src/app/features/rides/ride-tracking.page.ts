import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { subscribeToRide } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [DatePipe, IonBadge, IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar],
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
        <span class="car" *ngIf="ride && isTrackingStatus(ride.status)">Taxi</span>
      </section>

      <ion-list *ngIf="ride">
        <ion-item>
          <ion-label>
            <h2>{{ ride.pickup_address }}</h2>
            <p>{{ ride.dropoff_address ?? 'Sin destino' }}</p>
          </ion-label>
          <ion-badge [color]="getStatusColor(ride.status)">{{ ride.status }}</ion-badge>
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
        <ion-item>
          <ion-label>
            <h2>Fecha</h2>
            <p>{{ ride.pickup_at | date:'medium' }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" *ngIf="ride?.status === 'completed'">Calificar viaje</ion-button>
    </ion-content>
  `,
  styles: [`
    .map-shell {
      position: relative;
      min-height: 220px;
      margin-bottom: 16px;
      overflow: hidden;
      border-radius: 8px;
      background:
        linear-gradient(90deg, rgba(15, 118, 110, 0.12) 1px, transparent 1px),
        linear-gradient(rgba(15, 118, 110, 0.12) 1px, transparent 1px),
        #f8fafc;
      background-size: 32px 32px;
    }

    .route-line {
      position: absolute;
      inset: 62px 58px 72px 48px;
      border: 4px solid var(--ion-color-primary);
      border-left: 0;
      border-bottom: 0;
      border-radius: 0 42px 0 0;
    }

    .pin,
    .car {
      position: absolute;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
    }

    .pickup {
      left: 32px;
      bottom: 48px;
      background: var(--ion-color-secondary);
    }

    .dropoff {
      right: 44px;
      top: 42px;
      background: var(--ion-color-primary);
    }

    .car {
      right: 112px;
      top: 52px;
      width: 54px;
      border-radius: 999px;
      background: #111827;
      color: #fff;
    }
  `]
})
export class RideTrackingPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(TaxiAuthService);

  ride: RideRequest | null = null;
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
    this.channel = subscribeToRide(client, id, () => {
      this.loadRide(id);
    });
  }

  isTrackingStatus(status: string): boolean {
    return ['driver_assigned', 'arriving', 'in_progress'].includes(status);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      requested: 'warning',
      quoted: 'warning',
      confirmed: 'primary',
      driver_assigned: 'success',
      arriving: 'success',
      in_progress: 'tertiary',
      completed: 'medium',
      cancelled: 'danger'
    };
    return colors[status] ?? 'medium';
  }
}
