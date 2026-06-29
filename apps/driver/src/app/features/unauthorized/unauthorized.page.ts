import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  standalone: true,
  imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar, RouterLink],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sesion requerida</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>No tienes acceso</h1>
      <p>Inicia sesion para continuar.</p>
      <ion-button routerLink="/login">Iniciar sesion</ion-button>
    </ion-content>
  `
})
export class UnauthorizedPage {}
