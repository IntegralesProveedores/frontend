import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { logError } from './app/shared/utils/log.util';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => logError('Bootstrap error:', err));
