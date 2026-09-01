import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-order-failure',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent],
  templateUrl: './failure.component.html',
  styleUrl: './failure.component.css',
})
export class FailureComponent {}
