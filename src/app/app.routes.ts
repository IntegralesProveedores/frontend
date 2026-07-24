import { Routes } from '@angular/router';
import { cartNotEmptyGuard } from './core/guards/cart-not-empty.guard';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  { 
    path: '', 
    component: HomeComponent 
  },
  {
    path: 'productos',
    loadComponent: () =>
      import('./features/product-list/product-list.component').then(m => m.ProductListComponent)
  },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./features/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'productos/:slug/:variant',
    loadComponent: () =>
      import('./features/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'carrito',
    loadComponent: () =>
      import('./features/cart/cart.component').then(m => m.CartComponent)
  },
  {
    path: 'finalizar-compra',
    canActivate: [cartNotEmptyGuard],
	loadComponent: () =>
       import('./features/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'orden/exito',
    loadComponent: () =>
      import('./features/order-status/success/success.component').then(m => m.SuccessComponent)
  },
  {
    path: 'orden/error',
    loadComponent: () =>
      import('./features/order-status/failure/failure.component').then(m => m.FailureComponent)
  },
  {
    path: 'orden/pendiente',
    loadComponent: () =>
      import('./features/order-status/pending/pending.component').then(m => m.PendingComponent)
  },
  {
    path: 'orden/:id',
    loadComponent: () =>
      import('./features/order-status/detail/detail.component').then(m => m.DetailComponent)
  },
  {
    path: '**',
    redirectTo: 'productos'
  }
];
