import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { logError } from '../../utils/log.util';

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Widget de Cloudflare Turnstile (captcha invisible). Emite el
//           token cuando el visitante pasa la verificación, o null si
//           expira o falla.
// POR QUÉ:  El backend exige el token en /orders y /payments/create para
//           evitar abuso (mails a terceros, órdenes basura).
// CUIDADO:  Solo corre en el browser (SSR no lo renderiza). El script se
//           carga una sola vez; requiere https://challenges.cloudflare.com
//           en script-src y frame-src del CSP (server.ts y public/_headers).
// ─────────────────────────────────────────────────────────────

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'always' | 'execute' | 'interaction-only';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error('Turnstile no disponible'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('No se pudo cargar Turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

@Component({
  selector: 'app-turnstile',
  standalone: true,
  template: `<div #container></div>`,
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;
  @Output() token = new EventEmitter<string | null>();

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private widgetId: string | null = null;
  private destroyed = false;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    loadTurnstile()
      .then((turnstile) => {
        if (this.destroyed) return;
        this.widgetId = turnstile.render(this.container.nativeElement, {
          sitekey: environment.turnstileSiteKey,
          appearance: 'interaction-only',
          callback: (value) => this.token.emit(value),
          'expired-callback': () => this.token.emit(null),
          'error-callback': () => this.token.emit(null),
        });
      })
      .catch((error) => logError('Turnstile:', error));
  }

  /** El token sirve una sola vez: después de usarlo (ej. el backend respondió 409
   *  price_changed) hay que pedir uno nuevo para poder reintentar. */
  reset(): void {
    this.token.emit(null);
    if (this.widgetId) window.turnstile?.reset(this.widgetId);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) window.turnstile?.remove(this.widgetId);
  }
}
