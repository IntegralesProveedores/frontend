import { Component, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [EmptyStateComponent],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.css',
})
export class DetailComponent {
  notFound = signal(true); // Placeholder until real logic is implemented
}
