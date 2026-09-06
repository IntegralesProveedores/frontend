import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import { environment } from './src/environments/environment';

const MERCADOPAGO_ORIGINS = [
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.ar',
  'https://*.mercadolibre.com',
  'https://*.mlstatic.com',
];

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://static.cloudflareinsights.com'],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", environment.apiUrl, ...MERCADOPAGO_ORIGINS],
          formAction: ["'self'", ...MERCADOPAGO_ORIGINS],
          frameSrc: ["'self'", ...MERCADOPAGO_ORIGINS],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      // Alineado explícitamente con public/_headers (lo que realmente sirve
      // Cloudflare Pages hoy) para que no queden desincronizados: los
      // defaults de helmet difieren (HSTS de 180 días sin preload,
      // Referrer-Policy "no-referrer").
      hsts: { maxAge: 31536000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  server.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const response = await fetch('https://api.brotalia.com.ar/sitemap.xml');
      if (!response.ok) {
        res.status(response.status).send('Sitemap unavailable');
        return;
      }
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await response.text());
    } catch (error) {
      next(error);
    }
  });

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
