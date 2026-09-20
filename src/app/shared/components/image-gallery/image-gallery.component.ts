import { Component, Input, signal } from '@angular/core';
import { ProgressiveImageComponent } from '../progressive-image/progressive-image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { imageVariant, fallbackToOriginal } from '../../utils/image-variant.util';

export interface GalleryImage {
  id: string;
  url: string;
}

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [ProgressiveImageComponent, SkeletonComponent],
  templateUrl: './image-gallery.component.html',
  styleUrl: './image-gallery.component.css',
})
export class ImageGalleryComponent {
  @Input() set images(value: GalleryImage[] | null | undefined) {
    this._images = value ?? [];
    this.selectedIndex.set(0);
  }
  get images(): GalleryImage[] {
    return this._images;
  }

  @Input() alt = '';
  @Input() label = '';
  @Input() loading = false;

  readonly selectedIndex = signal(0);
  private _images: GalleryImage[] = [];

  get mainUrl(): string {
    return this._images[this.selectedIndex()]?.url ?? '';
  }

  readonly thumbUrl = (url: string) => imageVariant(url, 'thumb');
  readonly onThumbError = fallbackToOriginal;
}
