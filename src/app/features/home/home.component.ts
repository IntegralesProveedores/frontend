import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { HeroComponent } from './hero/hero.component';
import { BeneficiosComponent } from './beneficios/beneficios.component';
import { ProductosDestacadosComponent } from './productos-destacados/productos-destacados.component';
import { VentajasComponent } from './ventajas/ventajas.component';
import { ComoFuncionaComponent } from './como-funciona/como-funciona.component';
import { EnviosPagosComponent } from './envios-pagos/envios-pagos.component';
import { ContactoBrotaliaComponent } from './contacto-brotalia/contacto-brotalia.component';
import { FaqBrotaliaComponent } from './faq-brotalia/faq-brotalia.component';
import { Title, Meta } from '@angular/platform-browser';



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
    ContactoBrotaliaComponent,
    FaqBrotaliaComponent
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  ngOnInit(): void {
    this.titleService.setTitle('Brotalia | Macetas Biodegradables 100% Compostables al por Mayor');
    this.metaService.updateTag({ name: 'description', content: 'Macetas biodegradables de turba, papel y cartón para tu vivero, distribuidora o negocio. Mejor crecimiento radicular, sin stress de trasplante. Envíos a toda Argentina.' });
  }
}
