import { Component, Input, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * Componente para carga progresiva de imágenes con Skeleton Loading independiente.
 * Resuelve el parpadeo visual cuando los datos de la API llegan antes que la imagen.
 */
@Component({
  selector: 'app-progressive-img',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="progressive-image-container" [style.aspect-ratio]="aspectRatio">
      <!-- Skeleton: Se muestra mientras la imagen no ha cargado -->
      @if (!isLoaded()) {
        <app-skeleton 
          width="100%" 
          height="100%" 
          [radius]="radius"
          class="skeleton-overlay"
        />
      }

      <!-- Imagen Real -->
      <img
        [src]="src"
        [alt]="alt"
        [class]="imgClass"
        [class.loaded]="isLoaded()"
        (load)="onLoad()"
        loading="lazy"
      />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .progressive-image-container {
      position: relative;
      width: 100%;
      overflow: hidden;
      background-color: var(--color-bg-tertiary);
    }

    .skeleton-overlay {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      object-fit: cover;
    }

    img.loaded {
      opacity: 1;
    }
  `]
})
export class ProgressiveImageComponent {
  @Input({ required: true }) src!: string;
  @Input() alt: string = '';
  @Input() imgClass: string = '';
  @Input() aspectRatio: string = '1 / 1';
  @Input() radius: string = '0';

  private readonly platformId = inject(PLATFORM_ID);
  
  // Estado independiente de carga
  isLoaded = signal(false);

  /**
   * Maneja el evento load de la imagen nativa.
   * SSR Safe: El evento (load) solo ocurre en el navegador.
   */
  onLoad() {
    this.isLoaded.set(true);
  }
}
