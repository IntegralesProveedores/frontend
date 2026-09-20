import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-order-pending',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pending.component.html',
  styleUrl: './pending.component.css',
})
export class PendingComponent {}
