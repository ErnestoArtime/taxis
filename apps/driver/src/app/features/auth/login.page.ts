import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';

@Component({
  standalone: true,
  imports: [NgIf, FormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonItem, IonNote, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Chofer - Login</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Iniciar sesion</h1>
      <ion-item>
        <ion-input label="Correo electronico" labelPlacement="stacked" type="email" [(ngModel)]="email"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input label="Contrasena" labelPlacement="stacked" type="password" [(ngModel)]="password"></ion-input>
      </ion-item>
      <ion-note *ngIf="error">{{ error }}</ion-note>
      <ion-button expand="block" (click)="login()" [disabled]="loading">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </ion-button>
      <p class="register-link">¿No tienes cuenta? <a routerLink="/register">Registrate</a></p>
    </ion-content>
  `,
  styles: [`
    .register-link { text-align: center; margin-top: 16px; }
  `]
})
export class LoginPage {
  private auth = inject(TaxiAuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = '';
  loading = false;

  async login(): Promise<void> {
    this.loading = true;
    this.error = '';
    const result = await this.auth.signInWithEmail(this.email, this.password);
    this.loading = false;

    if (result.error) {
      this.error = result.error;
      return;
    }

    this.router.navigateByUrl('/');
  }
}
