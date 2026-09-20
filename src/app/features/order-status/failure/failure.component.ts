import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-order-failure',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './failure.component.html',
  styleUrl: './failure.component.css',
})
export class FailureComponent {}
