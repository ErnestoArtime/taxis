import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';
import { PricingRepository } from '@taxi/supabase';

interface TariffRule {
  id: string;
  label: string;
  kind: string;
  amount: number;
  currency: string;
}

@Component({
  standalone: true,
  imports: [
    NgIf, NgFor,
    FormsModule,
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tarifas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Reglas comerciales</h1>

      <ion-list>
        <ion-item *ngFor="let rule of tariffRules">
          <ion-label>
            <h2>{{ rule.label }}</h2>
            <p>{{ rule.kind }} - {{ rule.currency }} {{ rule.amount }}</p>
          </ion-label>
          <ion-badge>{{ rule.currency }} {{ rule.amount }}</ion-badge>
        </ion-item>
      </ion-list>

      <h2>Agregar regla</h2>
      <ion-list>
        <ion-item>
          <ion-select label="Tipo" labelPlacement="stacked" [(ngModel)]="newRule.kind">
            <ion-select-option value="base">Base</ion-select-option>
            <ion-select-option value="distance">Por kilometro</ion-select-option>
            <ion-select-option value="time">Por tiempo</ion-select-option>
            <ion-select-option value="surge">Sobreprecio</ion-select-option>
            <ion-select-option value="minimum">Minimo</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input label="Descripcion" labelPlacement="stacked" [(ngModel)]="newRule.label" placeholder="Nombre de la regla"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Monto" labelPlacement="stacked" type="number" [(ngModel)]="newRule.amount" min="0"></ion-input>
        </ion-item>
      </ion-list>
      <ion-button (click)="addRule()">Agregar regla</ion-button>
    </ion-content>
  `
})
export class PricingPage implements OnInit {
  private auth = inject(TaxiAuthService);
  private pricingRepo = inject(PricingRepository);

  tariffRules: TariffRule[] = [];
  newRule = {
    kind: 'base',
    label: '',
    amount: 0,
    currency: 'CUP'
  };

  ngOnInit(): void {
    this.loadRules();
  }

  private async loadRules(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }
    const { data } = await this.pricingRepo.listTariffRules(tenantId);
    if (data) {
      this.tariffRules = (data as Array<Record<string, unknown>>).map(r => ({
        id: r['id'] as string,
        label: r['label'] as string,
        kind: r['kind'] as string,
        amount: r['amount'] as number,
        currency: r['currency'] as string
      }));
    }
  }

  async addRule(): Promise<void> {
    const tenantId = this.auth.tenantId;
    if (!tenantId || !this.newRule.label) {
      return;
    }

    const client = this.auth.client;
    await client.from('tariff_rules').insert({
      tenant_id: tenantId,
      kind: this.newRule.kind,
      label: this.newRule.label,
      amount: this.newRule.amount,
      currency: this.newRule.currency,
      priority: 100,
      is_active: true
    });

    this.newRule = { kind: 'base', label: '', amount: 0, currency: 'CUP' };
    this.loadRules();
  }
}
