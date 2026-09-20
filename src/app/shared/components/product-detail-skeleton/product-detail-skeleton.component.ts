import { Component } from '@angular/core';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-product-detail-skeleton',
  standalone: true,
  imports: [ImageGalleryComponent, SkeletonComponent],
  templateUrl: './product-detail-skeleton.component.html',
  styleUrl: './product-detail-skeleton.component.css',
})
export class ProductDetailSkeletonComponent {}
