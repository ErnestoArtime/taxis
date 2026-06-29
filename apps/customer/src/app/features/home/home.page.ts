import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
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
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { BookingsRepository, NotificationsRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe,
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
    IonToolbar,
    RouterLink
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ tenantName }}</ion-title>
        <ion-badge *ngIf="unreadCount > 0" color="danger" slot="end">{{ unreadCount }}</ion-badge>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="hero">
        <h1>Reserva taxis confiables</h1>
        <p>Aeropuerto, hoteles, terminales y rutas privadas con confirmacion del operador.</p>
        <ion-button routerLink="/booking/new">Nueva reserva</ion-button>
      </section>

      <ion-card *ngIf="activeRide">
        <ion-card-content>
          <strong>Viaje activo</strong>
          <p>{{ activeRide.pickup_address }} -> {{ activeRide.dropoff_address ?? 'Sin destino' }}</p>
          <ion-button fill="clear" [routerLink]="['/rides', activeRide.id]">Ver seguimiento</ion-button>
        </ion-card-content>
      </ion-card>

      <ion-list>
        <ion-item *ngFor="let ride of recentRides">
          <ion-label>
            <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
            <p>{{ ride.pickup_at | date:'short' }}</p>
          </ion-label>
          <ion-badge [color]="getStatusColor(ride.status)">{{ ride.status }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .hero {
      padding: 20px 0 12px;
    }

    .hero h1 {
      margin: 0 0 8px;
      font-size: 32px;
      line-height: 1.1;
    }

    .hero p {
      margin: 0 0 16px;
      color: var(--ion-color-medium);
    }
  `]
})
export class HomePage implements OnInit {
  private auth = inject(TaxiAuthService);
  private bookingsRepo = inject(BookingsRepository);
  private notificationsRepo = inject(NotificationsRepository);

  tenantName = 'Habana Taxi';
  activeRide: RideRequest | null = null;
  recentRides: RideRequest[] = [];
  unreadCount = 0;

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    const [bookingsResult, notifResult] = await Promise.all([
      this.bookingsRepo.listForCustomer(userId),
      this.notificationsRepo.countUnread(userId)
    ]);

    if (bookingsResult.data) {
      this.activeRide = bookingsResult.data.find((r: RideRequest) =>
        ['requested', 'quoted', 'confirmed', 'driver_assigned', 'arriving', 'in_progress'].includes(r.status)
      ) ?? null;
      this.recentRides = bookingsResult.data.slice(0, 10);
    }

    if (notifResult.count !== null && notifResult.count !== undefined) {
      this.unreadCount = notifResult.count;
    }
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
