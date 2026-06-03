import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NavBarComponent } from '../home/nav-bar/nav-bar.component';
import { BannerPrincipalComponent } from '../home/banner-principal/banner-principal.component';
import { VentajasComponent } from '../home/ventajas/ventajas.component';
import { ProductosPreviewComponent } from '../home/productos-preview/productos-preview.component';
import { ServiciosComponent } from '../home/servicios/servicios.component';
import { ContactoComponent } from '../home/contacto/contacto.component';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [
    CommonModule,
    RouterModule,
    NavBarComponent,
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
