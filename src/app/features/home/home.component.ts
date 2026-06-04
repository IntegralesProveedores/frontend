import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { BannerPrincipalComponent } from './banner-principal/banner-principal.component';
import { VentajasComponent } from './ventajas/ventajas.component';
import { ProductosPreviewComponent } from './productos-preview/productos-preview.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { ContactoComponent } from './contacto/contacto.component';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [
    CommonModule,
    RouterModule,
    NavbarComponent,
    BannerPrincipalComponent,
    VentajasComponent,
    ProductosPreviewComponent,
    ServiciosComponent,
    ContactoComponent,
  ]
})
export class HomeComponent implements OnInit {

  constructor() {  }

  ngOnInit(): void {

  }

}
