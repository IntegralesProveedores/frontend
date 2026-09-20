import {
  Component,
  OnDestroy,
  OnInit,
  Renderer2,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { PricingConfigService } from '../../core/services/pricing-config.service';
import { Product, ProductVariant } from '../../core/models/product.model';
import { logError } from '../../shared/utils/log.util';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BuyBoxComponent } from '../../shared/components/buy-box/buy-box.component';
import { ImageGalleryComponent } from '../../shared/components/image-gallery/image-gallery.component';
import { ProductDetailSkeletonComponent } from '../../shared/components/product-detail-skeleton/product-detail-skeleton.component';
import { ComoFuncionaComponent } from '../home/como-funciona/como-funciona.component';
import { FaqBrotaliaComponent } from '../home/faq-brotalia/faq-brotalia.component';
import { ContactoBrotaliaComponent } from '../home/contacto-brotalia/contacto-brotalia.component';
import {
  CERTIFICACIONES,
  MATERIALES,
  PACK_IMAGES,
  PACK_UNITS,
  PAGE_URL,
  PRODUCT_SLUG,
  REDES,
  SOSTENIBILIDAD,
  VIDEO_URL,
} from './landing.content';

const JSONLD_ID = 'olivo-pack-jsonld';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    BuyBoxComponent,
    ImageGalleryComponent,
    ProductDetailSkeletonComponent,
    ComoFuncionaComponent,
    FaqBrotaliaComponent,
    ContactoBrotaliaComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  readonly pricingConfigService = inject(PricingConfigService);

  readonly packUnits = PACK_UNITS;
  readonly packImageUrl = PACK_IMAGES[0];
  readonly materiales = MATERIALES;
  readonly sostenibilidad = SOSTENIBILIDAD;
  readonly videoUrl = VIDEO_URL;
  readonly certificaciones = CERTIFICACIONES;
  readonly redes = REDES;
  readonly breadcrumb = [
    { label: 'Inicio', link: '/' },
    { label: `Olivo pack x${PACK_UNITS}` },
  ];

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly variant = computed<ProductVariant | null>(
    () =>
      this.product()?.variants.find((v) => v.units_per_pack === PACK_UNITS) ??
      null,
  );

  /** Fotos del pack + las 3 primeras fotos de Olivo. */
  readonly galleryImages = computed(() => [
    ...PACK_IMAGES.map((url, i) => ({ id: `pack-${i}`, url })),
    ...(this.product()?.images ?? [])
      .slice(0, 3)
      .map((i) => ({ id: i.id, url: i.url })),
  ]);

  /** Escalones de descuento por volumen, expresados en unidades. */
  readonly volumeTiers = computed(() => {
    const master = this.product()?.units_per_pack_master ?? 1;
    return [...(this.pricingConfigService.pricingConfig()?.volume_discounts ?? [])]
      .filter((d) => d.factor > 1)
      .sort((a, b) => a.min - b.min)
      .map((d) => d.min * master);
  });

  ngOnInit(): void {
    this.api.get<Product>(`/products/${PRODUCT_SLUG}`).subscribe({
      next: (data) => {
        this.pricingConfigService.setPricingConfig(data.pricing_config);
        this.product.set(data);
        this.loading.set(false);
        this.applySeo(data);
      },
      error: (err) => {
        logError('Error cargando la landing de Olivo pack', err);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  private applySeo(product: Product): void {
    const title = `Macetas Biodegradables Olivo Pack x${PACK_UNITS} | Brotalia`;
    const description = `Pack de ${PACK_UNITS} macetas biodegradables Olivo, 100% compostables (turba, papel y cartón). Sin stress de trasplante y con envíos a toda Argentina.`;
    const image = PACK_IMAGES[0] ?? product.images?.[0]?.url ?? '';
    const absoluteImage = image
      ? image.startsWith('http')
        ? image
        : `https://brotalia.com.ar${image}`
      : '';

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:url', content: PAGE_URL });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    if (absoluteImage) {
      this.metaService.updateTag({ property: 'og:image', content: absoluteImage });
      this.metaService.updateTag({ name: 'twitter:image', content: absoluteImage });
    }

    this.document.head.querySelector('link[rel="canonical"]')?.remove();
    const canonical = this.renderer.createElement('link');
    this.renderer.setAttribute(canonical, 'rel', 'canonical');
    this.renderer.setAttribute(canonical, 'href', PAGE_URL);
    this.renderer.appendChild(this.document.head, canonical);

    const variant = this.variant();
    if (!variant) return;
    this.removeJsonLd();
    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', JSONLD_ID);
    this.renderer.appendChild(
      script,
      this.renderer.createText(
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `${product.name} - Pack x${PACK_UNITS}`,
          description,
          sku: variant.sku,
          brand: { '@type': 'Brand', name: 'Brotalia' },
          ...(absoluteImage ? { image: absoluteImage } : {}),
          offers: {
            '@type': 'Offer',
            url: PAGE_URL,
            priceCurrency: 'ARS',
            price: Number(variant.price_ars) || 0,
            availability:
              variant.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          },
        }),
      ),
    );
    this.renderer.appendChild(this.document.head, script);
  }

  private removeJsonLd(): void {
    this.document.getElementById(JSONLD_ID)?.remove();
  }
}
