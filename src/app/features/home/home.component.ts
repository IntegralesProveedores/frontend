import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { HeroComponent } from './hero/hero.component';
import { BeneficiosComponent } from './beneficios/beneficios.component';
import { ProductosDestacadosComponent } from './productos-destacados/productos-destacados.component';
import { VentajasComponent } from './ventajas/ventajas.component';
import { ComoFuncionaComponent } from './como-funciona/como-funciona.component';
import { EnviosPagosComponent } from './envios-pagos/envios-pagos.component';
import { ContactoBrotaliaComponent } from './contacto-brotalia/contacto-brotalia.component';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeroComponent,
    BeneficiosComponent,
    ProductosDestacadosComponent,
	VentajasComponent,
    ComoFuncionaComponent,
    EnviosPagosComponent,
    ContactoBrotaliaComponent
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent {}
