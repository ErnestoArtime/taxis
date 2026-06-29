import { bootstrapApplication } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { APP_INITIALIZER } from '@angular/core';
import { TaxiAuthService, TAXI_AUTH_CONFIG } from '@taxi/auth';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { environment } from './environments/environment';

function initAuth(auth: TaxiAuthService): () => Promise<void> {
  return () => auth.init();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(appRoutes),
    { provide: TAXI_AUTH_CONFIG, useValue: environment },
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [TaxiAuthService],
      multi: true
    }
  ]
}).catch((error) => console.error(error));
