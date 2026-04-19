import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-order-failure',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './failure.component.html',
  styleUrl: './failure.component.css'
})
export class FailureComponent {}


