import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonInput,
  IonItem, IonLabel, IonList, IonSelect, IonSelectOption,
  IonTitle, IonToolbar, IonNote, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { PricingRepository } from '@taxi/supabase';

interface TariffRule {
  id: string;
  label: string;
  kind: string;
  amount: number;
  currency: string;
  is_active: boolean;
  priority: number;
  editing?: boolean;
}

interface VehicleClass {
  id: string;
  name: string;
  description: string;
  seats: number;
  sort_order: number;
  is_active: boolean;
  editing?: boolean;
}

@Component({
  standalone: true,
  imports: [
    NgIf, NgFor, FormsModule, IonBadge, IonButton, IonContent,
    IonHeader, IonInput, IonItem, IonLabel, IonList, IonNote,
    IonSelect, IonSelectOption, IonTitle, IonToolbar,
    IonSegment, IonSegmentButton
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tarifas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-segment [(ngModel)]="tab">
        <ion-segment-button value="rules">Reglas</ion-segment-button>
        <ion-segment-button value="classes">Vehiculos</ion-segment-button>
      </ion-segment>

      <!-- ── Reglas de tarifa ── -->
      <ng-container *ngIf="tab === 'rules'">
        <h1>Reglas comerciales</h1>

        <ion-list>
          <ion-item *ngFor="let rule of tariffRules">
            <ng-container *ngIf="!rule.editing; else ruleEdit">
              <ion-label>
                <h2>{{ rule.label }}</h2>
                <p>{{ rule.kind }} · {{ rule.currency }} {{ rule.amount }}</p>
              </ion-label>
              <ion-badge [color]="rule.is_active ? 'success' : 'medium'" slot="start">
                {{ rule.is_active ? 'Activa' : 'Inactiva' }}
              </ion-badge>
              <ion-button fill="clear" slot="end" (click)="toggleEdit(rule)">Editar</ion-button>
              <ion-button fill="clear" color="danger" slot="end" (click)="deleteRule(rule)">Eliminar</ion-button>
            </ng-container>
            <ng-template #ruleEdit>
              <ion-list class="edit-form">
                <ion-item>
                  <ion-input label="Nombre" [(ngModel)]="rule.label" placeholder="Nombre regla"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-select label="Tipo" [(ngModel)]="rule.kind">
                    <ion-select-option value="base">Base</ion-select-option>
                    <ion-select-option value="distance">Por km</ion-select-option>
                    <ion-select-option value="time">Por tiempo</ion-select-option>
                    <ion-select-option value="surge">Sobreprecio</ion-select-option>
                    <ion-select-option value="minimum">Minimo</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input label="Monto" type="number" [(ngModel)]="rule.amount" min="0"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-select label="Estado" [(ngModel)]="rule.is_active">
                    <ion-select-option [value]="true">Activa</ion-select-option>
                    <ion-select-option [value]="false">Inactiva</ion-select-option>
                  </ion-select>
                </ion-item>
                <div class="edit-actions">
                  <ion-button size="small" (click)="saveRule(rule)">Guardar</ion-button>
                  <ion-button size="small" fill="outline" (click)="cancelEdit(rule)">Cancelar</ion-button>
                </div>
              </ion-list>
            </ng-template>
          </ion-item>
        </ion-list>

        <h2>Agregar regla</h2>
        <ion-list>
          <ion-item>
            <ion-select label="Tipo" [(ngModel)]="newRule.kind">
              <ion-select-option value="base">Base</ion-select-option>
              <ion-select-option value="distance">Por kilometro</ion-select-option>
              <ion-select-option value="time">Por tiempo</ion-select-option>
              <ion-select-option value="surge">Sobreprecio</ion-select-option>
              <ion-select-option value="minimum">Minimo</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input label="Descripcion" [(ngModel)]="newRule.label" placeholder="Nombre de la regla"></ion-input>
          </ion-item>
          <ion-item>
            <ion-input label="Monto" type="number" [(ngModel)]="newRule.amount" min="0"></ion-input>
          </ion-item>
        </ion-list>
        <ion-button (click)="addRule()" [disabled]="!newRule.label">Agregar regla</ion-button>
      </ng-container>

      <!-- ── Clases de vehiculo ── -->
      <ng-container *ngIf="tab === 'classes'">
        <h1>Clases de vehiculo</h1>

        <ion-list>
          <ion-item *ngFor="let vc of vehicleClasses">
            <ng-container *ngIf="!vc.editing; else vcEdit">
              <ion-label>
                <h2>{{ vc.name }}</h2>
                <p>{{ vc.seats }} asientos · {{ vc.is_active ? 'Activo' : 'Inactivo' }}</p>
              </ion-label>
              <ion-button fill="clear" slot="end" (click)="toggleEditVc(vc)">Editar</ion-button>
              <ion-button fill="clear" color="danger" slot="end" (click)="deleteVc(vc)">Eliminar</ion-button>
            </ng-container>
            <ng-template #vcEdit>
              <ion-list class="edit-form">
                <ion-item>
                  <ion-input label="Nombre" [(ngModel)]="vc.name"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-input label="Asientos" type="number" [(ngModel)]="vc.seats" min="1"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-select label="Estado" [(ngModel)]="vc.is_active">
                    <ion-select-option [value]="true">Activo</ion-select-option>
                    <ion-select-option [value]="false">Inactivo</ion-select-option>
                  </ion-select>
                </ion-item>
                <div class="edit-actions">
                  <ion-button size="small" (click)="saveVc(vc)">Guardar</ion-button>
                  <ion-button size="small" fill="outline" (click)="cancelEditVc(vc)">Cancelar</ion-button>
                </div>
              </ion-list>
            </ng-template>
          </ion-item>
        </ion-list>

        <h2>Agregar clase</h2>
        <ion-list>
          <ion-item>
            <ion-input label="Nombre" [(ngModel)]="newVc.name" placeholder="Ej: Estandar"></ion-input>
          </ion-item>
          <ion-item>
            <ion-input label="Asientos" type="number" [(ngModel)]="newVc.seats" min="1"></ion-input>
          </ion-item>
        </ion-list>
        <ion-button (click)="addVc()" [disabled]="!newVc.name">Agregar clase</ion-button>
      </ng-container>

      <ion-note *ngIf="saved" color="success">Guardado</ion-note>
      <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>
    </ion-content>
  `,
  styles: [`
    .edit-form { width: 100%; padding: 0; }
    .edit-actions { display: flex; gap: 8px; padding: 8px 16px; }
    ion-segment { margin-bottom: 16px; }
  `]
})
export class PricingPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private pricingRepo = inject(PricingRepository);

  tab: 'rules' | 'classes' = 'rules';

  tariffRules: TariffRule[] = [];
  newRule = { kind: 'base', label: '', amount: 0, currency: 'CUP' };

  vehicleClasses: VehicleClass[] = [];
  newVc = { name: '', seats: 4 };

  saved = false;
  error = '';

  ngOnInit(): void {
    this.loadRules();
    this.loadClasses();
  }

  private async loadRules(): Promise<void> {
    const tid = this.auth.tenantId;
    if (!tid) return;
    const { data } = await this.pricingRepo.listTariffRules(tid);
    if (data) {
      this.tariffRules = (data as Record<string, unknown>[]).map(r => ({
        id: r['id'] as string,
        label: r['label'] as string,
        kind: r['kind'] as string,
        amount: r['amount'] as number,
        currency: r['currency'] as string,
        is_active: r['is_active'] as boolean,
        priority: r['priority'] as number
      }));
    }
  }

  private async loadClasses(): Promise<void> {
    const tid = this.auth.tenantId;
    if (!tid) return;
    const { data } = await this.pricingRepo.listAllVehicleClasses(tid);
    if (data) {
      this.vehicleClasses = (data as Record<string, unknown>[]).map(v => ({
        id: v['id'] as string,
        name: v['name'] as string,
        description: (v['description'] as string) ?? '',
        seats: v['seats'] as number,
        sort_order: v['sort_order'] as number,
        is_active: v['is_active'] as boolean
      }));
    }
  }

  toggleEdit(rule: TariffRule): void {
    rule.editing = !rule.editing;
  }

  cancelEdit(rule: TariffRule): void {
    rule.editing = false;
    this.loadRules();
  }

  async saveRule(rule: TariffRule): Promise<void> {
    this.error = '';
    const tid = this.auth.tenantId;
    if (!tid) return;
    const { error } = await this.pricingRepo.upsertRule({
      id: rule.id,
      tenant_id: tid,
      kind: rule.kind,
      label: rule.label,
      amount: rule.amount,
      currency: rule.currency,
      is_active: rule.is_active,
      priority: rule.priority
    });
    rule.editing = false;
    if (error) { this.error = error.message; return; }
    this.saved = true;
    setTimeout(() => this.saved = false, 2000);
  }

  async deleteRule(rule: TariffRule): Promise<void> {
    this.error = '';
    const { error } = await this.pricingRepo.deleteRule(rule.id);
    if (error) { this.error = error.message; return; }
    this.loadRules();
  }

  async addRule(): Promise<void> {
    const tid = this.auth.tenantId;
    if (!tid || !this.newRule.label) return;
    const { error } = await this.pricingRepo.upsertRule({
      tenant_id: tid,
      kind: this.newRule.kind,
      label: this.newRule.label,
      amount: this.newRule.amount,
      currency: this.newRule.currency,
      priority: 100,
      is_active: true
    });
    if (error) { this.error = error.message; return; }
    this.newRule = { kind: 'base', label: '', amount: 0, currency: 'CUP' };
    this.loadRules();
  }

  toggleEditVc(vc: VehicleClass): void { vc.editing = !vc.editing; }
  cancelEditVc(vc: VehicleClass): void { vc.editing = false; this.loadClasses(); }

  async saveVc(vc: VehicleClass): Promise<void> {
    this.error = '';
    const tid = this.auth.tenantId;
    if (!tid) return;
    const { error } = await this.pricingRepo.upsertVehicleClass({
      id: vc.id, tenant_id: tid, name: vc.name,
      description: vc.description, seats: vc.seats,
      sort_order: vc.sort_order, is_active: vc.is_active
    });
    vc.editing = false;
    if (error) { this.error = error.message; return; }
    this.saved = true;
    setTimeout(() => this.saved = false, 2000);
  }

  async deleteVc(vc: VehicleClass): Promise<void> {
    const { error } = await this.pricingRepo.deleteVehicleClass(vc.id);
    if (error) { this.error = error.message; return; }
    this.loadClasses();
  }

  async addVc(): Promise<void> {
    const tid = this.auth.tenantId;
    if (!tid || !this.newVc.name) return;
    const { error } = await this.pricingRepo.upsertVehicleClass({
      tenant_id: tid, name: this.newVc.name,
      description: '', seats: this.newVc.seats,
      sort_order: 500, is_active: true
    });
    if (error) { this.error = error.message; return; }
    this.newVc = { name: '', seats: 4 };
    this.loadClasses();
  }
}
