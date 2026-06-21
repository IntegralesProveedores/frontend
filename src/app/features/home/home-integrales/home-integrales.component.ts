import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BannerPrincipalComponent } from './banner-principal/banner-principal.component';
import { VentajasComponent } from './ventajas/ventajas.component';
import { ProductosPreviewComponent } from './productos-preview/productos-preview.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { ContactoComponent } from './contacto/contacto.component';

@Component({
  selector: 'app-home-integrales',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BannerPrincipalComponent,
    VentajasComponent,
    ProductosPreviewComponent,
    ServiciosComponent,
    ContactoComponent
  ],
  templateUrl: './home-integrales.component.html',
  styleUrls: ['./home-integrales.component.css']
})
export class HomeIntegralesComponent {}
