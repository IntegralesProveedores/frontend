import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SessionContextService } from '../../../../core/services/session-context.service';

@Component({
  selector: 'app-banner-principal',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './banner-principal.component.html',
  styleUrl: './banner-principal.component.css'
})
export class BannerPrincipalComponent {
  public readonly session = inject(SessionContextService);
}
