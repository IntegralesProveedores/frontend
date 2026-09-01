import { Component, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-faq-brotalia',
  standalone: true,
  imports: [],
  templateUrl: './faq-brotalia.component.html',
  styleUrl: '../envios-pagos/envios-pagos.component.css',
})
export class FaqBrotaliaComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const existing = this.document.getElementById('faq-jsonld');
    existing?.parentNode?.removeChild(existing);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        [
          '¿Qué son las macetas biodegradables?',
          'Son macetas hechas de turba, papel y cartón que se degradan en contacto con la tierra y se transforman en materia orgánica, sin dejar residuos plásticos.',
        ],
        [
          '¿Las macetas biodegradables de Brotalia se plantan directo en la tierra?',
          'Sí. Se planta la maceta entera, sin retirarla ni remover la planta, evitando el stress de trasplante y favoreciendo un sistema radicular más denso.',
        ],
        [
          '¿Venden macetas biodegradables por mayor?',
          'Sí, trabajamos con viveros, distribuidoras y revendedores en toda Argentina, con presentaciones de distintas cantidades por modelo.',
        ],
        [
          '¿Hacen envíos a todo el país?',
          'Sí, envíos sin cargo en C.A.B.A. y al resto del país mediante el transporte que elijas.',
        ],
      ].map(([name, text]) => ({
        '@type': 'Question',
        name,
        acceptedAnswer: { '@type': 'Answer', text },
      })),
    };
    const script = this.renderer.createElement('script');
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'id', 'faq-jsonld');
    this.renderer.appendChild(
      script,
      this.renderer.createText(JSON.stringify(schema)),
    );
    this.renderer.appendChild(this.document.head, script);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const script = this.document.getElementById('faq-jsonld');
    script?.parentNode?.removeChild(script);
  }
}
