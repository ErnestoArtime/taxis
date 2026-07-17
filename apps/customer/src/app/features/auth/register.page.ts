import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem,
  IonNote, IonTitle, IonToolbar
} from '@ionic/angular/standalone';
import { TaxiAuthService } from '@taxi/auth';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonItem, IonNote, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Crear cuenta</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Registrarse</h1>
      <ion-item>
        <ion-input label="Nombre completo" labelPlacement="stacked" [(ngModel)]="displayName"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input label="Correo electronico" labelPlacement="stacked" type="email" [(ngModel)]="email"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input label="Telefono" labelPlacement="stacked" type="tel" [(ngModel)]="phone"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input label="Contrasena" labelPlacement="stacked" type="password" [(ngModel)]="password"></ion-input>
      </ion-item>
      <ion-note *ngIf="error" color="danger">{{ error }}</ion-note>
      <ion-note *ngIf="success" color="success">{{ success }}</ion-note>
      <ion-button expand="block" (click)="register()" [disabled]="loading || !email || !password || !displayName">
        {{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}
      </ion-button>
      <p class="login-link">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesion</a></p>
    </ion-content>
  `,
  styles: [`
    .login-link { text-align: center; margin-top: 16px; }
  `]
})
export class RegisterPage {
  private auth = inject(TaxiAuthService);
  private router = inject(Router);

  displayName = '';
  email = '';
  phone = '';
  password = '';
  error = '';
  success = '';
  loading = false;

  async register(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.success = '';

    const result = await this.auth.signUpWithEmail(this.email, this.password, {
      displayName: this.displayName,
      phone: this.phone || undefined
    });

    this.loading = false;

    if (result.error) {
      this.error = result.error;
      return;
    }

    this.success = 'Cuenta creada. Revisa tu correo para confirmar.';
    setTimeout(() => this.router.navigateByUrl('/login'), 3000);
  }
}
