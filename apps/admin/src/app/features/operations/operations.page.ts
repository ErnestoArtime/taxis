import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgIf, NgFor } from '@angular/common';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonGrid,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { OperationsRepository } from '@taxi/supabase';
import type { RideRequest } from '@taxi/domain';

@Component({
  standalone: true,
  imports: [
    DatePipe, NgIf, NgFor,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonGrid,
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
        <ion-title>Operaciones</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="toolbar-actions">
        <h1>Dashboard operativo</h1>
        <div>
          <ion-button routerLink="/dispatch">Despacho</ion-button>
          <ion-button fill="outline" routerLink="/pricing">Tarifas</ion-button>
          <ion-button fill="outline" routerLink="/settings">Marca</ion-button>
        </div>
      </section>

      <ion-grid class="metrics">
        <ion-card>
          <ion-card-content>
            <span>Pendientes</span>
            <strong>{{ summary?.pendingRides ?? 0 }}</strong>
          </ion-card-content>
        </ion-card>
        <ion-card>
          <ion-card-content>
            <span>En curso</span>
            <strong>{{ summary?.activeRides ?? 0 }}</strong>
          </ion-card-content>
        </ion-card>
        <ion-card>
          <ion-card-content>
            <span>Choferes activos</span>
            <strong>{{ summary?.availableDrivers ?? 0 }}</strong>
          </ion-card-content>
        </ion-card>
        <ion-card>
          <ion-card-content>
            <span>Ingresos hoy</span>
            <strong>CUP {{ summary?.revenueToday ?? 0 }}</strong>
          </ion-card-content>
        </ion-card>
      </ion-grid>

      <ion-list>
        <ion-item *ngFor="let ride of openRides">
          <ion-label>
            <h2>{{ ride.pickup_address }} -> {{ ride.dropoff_address ?? 'Sin destino' }}</h2>
            <p>{{ ride.pickup_at | date:'short' }}</p>
          </ion-label>
          <ion-badge [color]="ride.status === 'requested' ? 'warning' : 'success'">
            {{ ride.status === 'requested' ? 'Sin asignar' : ride.status }}
          </ion-badge>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .toolbar-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .toolbar-actions h1 {
      margin: 0;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      padding: 12px 0;
    }

    .metrics ion-card {
      margin: 0;
    }

    .metrics span,
    .metrics strong {
      display: block;
    }

    .metrics strong {
      margin-top: 8px;
      font-size: 24px;
    }
  `]
})
export class OperationsPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private operationsRepo = inject(OperationsRepository);

  summary: {
    pendingRides: number;
    activeRides: number;
    completedToday: number;
    availableDrivers: number;
    revenueToday: number;
  } | null = null;
  openRides: RideRequest[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }

    const [summaryResult, ridesResult] = await Promise.all([
      this.operationsRepo.getSummary(tenantId),
      this.operationsRepo.listOpenRides(tenantId)
    ]);

    if (summaryResult.data) {
      const d = summaryResult.data as Record<string, unknown>;
      this.summary = {
        pendingRides: d['pending_rides'] as number,
        activeRides: d['active_rides'] as number,
        completedToday: d['completed_today'] as number,
        availableDrivers: d['available_drivers'] as number,
        revenueToday: d['revenue_today'] as number
      };
    }

    if (ridesResult.data) {
      this.openRides = ridesResult.data as unknown as RideRequest[];
    }
  }
}
