import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionContextService } from '../../core/services/session-context.service';
import { HomeIntegralesComponent } from './home-integrales/home-integrales.component';
import { HomeBrotaliaComponent } from './home-brotalia/home-brotalia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HomeIntegralesComponent, HomeBrotaliaComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  session = inject(SessionContextService);
}
