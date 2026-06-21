import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { HeroComponent } from './hero/hero.component';
import { BeneficiosComponent } from './beneficios/beneficios.component';
import { ProductosDestacadosComponent } from './productos-destacados/productos-destacados.component';
import { ComoFuncionaComponent } from './como-funciona/como-funciona.component';
import { EnviosPagosComponent } from './envios-pagos/envios-pagos.component';
import { ContactoBrotaliaComponent } from './contacto-brotalia/contacto-brotalia.component';

@Component({
  selector: 'app-home-brotalia',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeroComponent,
    BeneficiosComponent,
    ProductosDestacadosComponent,
    ComoFuncionaComponent,
    EnviosPagosComponent,
    ContactoBrotaliaComponent
  ],
  templateUrl: './home-brotalia.component.html',
  styleUrls: ['./home-brotalia.component.css']
})
export class HomeBrotaliaComponent {}