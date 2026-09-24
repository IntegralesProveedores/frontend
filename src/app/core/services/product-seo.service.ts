import { Injectable, RendererFactory2, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { Product, ProductVariant } from '../models/product.model';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: SEO de la ficha de producto: título, meta description, Open Graph, Twitter,
//           canonical y datos estructurados (JSON-LD de Product y BreadcrumbList).
// POR QUÉ:  Antes vivía dentro de ProductDetailComponent mezclado con precio, stock y
//           carrito. Corre también en el servidor: así queda en el HTML prerenderizado
//           (buscadores y asistentes que no ejecutan JS).
// ─────────────────────────────────────────────────────────────

const SITE_URL = 'https://brotalia.com.ar';
const JSON_LD_IDS = ['product-jsonld', 'breadcrumb-jsonld'] as const;

interface ProductJsonLd {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
  image?: string;
  sku?: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers:
    | {
        '@type': 'Offer';
        priceCurrency: 'ARS';
        price: number;
        availability: string;
      }
    | {
        '@type': 'AggregateOffer';
        priceCurrency: 'ARS';
        lowPrice: number;
        highPrice: number;
        offerCount: number;
        availability: string;
      };
}

@Injectable({ providedIn: 'root' })
export class ProductSeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  /** Etiquetas de la ficha. `presentation`: la de la URL (/productos/:slug/:variant), si hay. */
  setProductPage(data: Product, slug: string, presentation: ProductVariant | null): void {
    const pageTitle = `Maceta Biodegradable ${data.name}${presentation ? ` ${presentation.units_per_pack} u.` : ''} | Brotalia`;
    const fallbackDescription = presentation
      ? `Maceta biodegradable ${data.name} ${presentation.units_per_pack} unidades, 100% compostable (turba, papel y cartón). Sin stress de trasplante, mayor crecimiento de raíces. Venta mayorista y minorista con envío a toda Argentina.`
      : `Maceta biodegradable ${data.name}, 100% compostable (turba, papel y cartón). Sin stress de trasplante, mayor crecimiento de raíces. Venta mayorista y minorista con envío a toda Argentina.`;
    const rawDescription =
      typeof data.description === 'string' ? data.description.trim() : '';
    const metaDescription =
      rawDescription.length > 0 ? rawDescription : fallbackDescription;
    const imageUrl = data.images?.[0]?.url ?? '';
    const absoluteImageUrl = imageUrl
      ? imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
        ? imageUrl
        : `${SITE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
      : '';
    const pageUrl = `${SITE_URL}/productos/${slug}`;

    this.titleService.setTitle(pageTitle);
    this.metaService.updateTag({ name: 'description', content: metaDescription });
    this.metaService.updateTag({ property: 'og:title', content: pageTitle });
    this.metaService.updateTag({ property: 'og:description', content: metaDescription });
    this.metaService.updateTag({ property: 'og:url', content: pageUrl });
    this.metaService.updateTag({ name: 'twitter:title', content: pageTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: metaDescription });
    this.setCanonical(pageUrl);
    if (absoluteImageUrl) {
      this.metaService.updateTag({ property: 'og:image', content: absoluteImageUrl });
      this.metaService.updateTag({ name: 'twitter:image', content: absoluteImageUrl });
    }
    this.setStructuredData(data, metaDescription, absoluteImageUrl);
  }

  /** Título cuando la ficha no se pudo cargar. */
  setErrorTitle(notFound: boolean): void {
    this.titleService.setTitle(
      notFound
        ? 'Producto no encontrado | Brotalia'
        : 'Brotalia | Macetas Biodegradables',
    );
  }

  /** Al salir de la ficha, sus datos estructurados no deben quedar en el <head> de otra página. */
  clearStructuredData(): void {
    for (const id of JSON_LD_IDS) this.document.getElementById(id)?.remove();
  }

  private setCanonical(href: string): void {
    const existingCanonical = this.document.head.querySelector(
      'link[rel="canonical"]',
    );
    if (existingCanonical?.parentNode) {
      existingCanonical.parentNode.removeChild(existingCanonical);
    }
    const canonical = this.renderer.createElement('link');
    this.renderer.setAttribute(canonical, 'rel', 'canonical');
    this.renderer.setAttribute(canonical, 'href', href);
    this.renderer.appendChild(this.document.head, canonical);
  }

  private setStructuredData(
    data: Product,
    metaDescription: string,
    absoluteImageUrl: string,
  ): void {
    // En el navegador se reemplaza por id, sin duplicarse.
    for (const id of JSON_LD_IDS) {
      const existing = this.document.getElementById(id);
      if (existing?.parentNode) existing.parentNode.removeChild(existing);
    }

    const variants = data.variants ?? [];
    const offerCount = variants.length;
    if (offerCount === 0) return;

    const stockAvailable = variants.some((v) => (Number(v.stock) || 0) > 0);
    const availability = stockAvailable
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

    const baseSchema: ProductJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: data.name,
      description: metaDescription,
      sku: variants[0]?.sku,
      brand: {
        '@type': 'Brand',
        name: 'Brotalia',
      },
      offers:
        offerCount === 1
          ? {
              '@type': 'Offer',
              priceCurrency: 'ARS',
              price: Number(variants[0]?.price_ars) || 0,
              availability,
            }
          : {
              '@type': 'AggregateOffer',
              priceCurrency: 'ARS',
              lowPrice: Math.min(
                ...variants.map((v) => Number(v.price_ars) || 0),
              ),
              highPrice: Math.max(
                ...variants.map((v) => Number(v.price_ars) || 0),
              ),
              offerCount,
              availability,
            },
    };

    if (absoluteImageUrl) {
      baseSchema.image = absoluteImageUrl;
    }

    this.appendJsonLd('product-jsonld', baseSchema);
    this.appendJsonLd('breadcrumb-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Productos', item: `${SITE_URL}/productos` },
        { '@type': 'ListItem', position: 3, name: data.name, item: `${SITE_URL}/productos/${data.slug}` },
      ],
    });
  }

  private appendJsonLd(id: string, schema: object): void {
    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', id);
    this.renderer.appendChild(script, this.renderer.createText(JSON.stringify(schema)));
    this.renderer.appendChild(this.document.head, script);
  }
}
