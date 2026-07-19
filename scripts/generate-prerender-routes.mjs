import { writeFile } from 'node:fs/promises';

const API_URL = 'https://api.brotalia.com.ar/products';
const ROUTES_FILE = new URL('../prerender-routes.txt', import.meta.url);
const FETCH_TIMEOUT_MS = 10_000;

const STATIC_ROUTES = [
  '/',
  '/productos',
  '/carrito',
  '/finalizar-compra',
  '/orden/exito',
  '/orden/error',
];

function uniqueRoutes(routes) {
  return [...new Set(routes)];
}

async function getProductRoutes() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`API respondió HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.items)) {
      throw new Error('La respuesta de la API no contiene un array "items"');
    }

    const slugs = payload.items
      .map(product => product?.slug)
      .filter(slug => typeof slug === 'string' && slug.trim().length > 0)
      .map(slug => slug.trim().replace(/^\/+|\/+$/g, ''));

    if (slugs.length !== payload.items.length) {
      console.warn('[prerender] Se ignoraron productos sin slug válido.');
    }

    return uniqueRoutes(slugs.map(slug => `/productos/${slug}`));
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let routes = STATIC_ROUTES;

  try {
    const productRoutes = await getProductRoutes();
    routes = uniqueRoutes([...STATIC_ROUTES, ...productRoutes]);
    console.log(`[prerender] Se encontraron ${productRoutes.length} productos.`);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? `timeout después de ${FETCH_TIMEOUT_MS} ms`
      : error instanceof Error ? error.message : String(error);

    console.error(`[prerender] No se pudieron obtener los productos: ${message}`);
    console.error('[prerender] Se continuará con las rutas estáticas únicamente.');
  }

  await writeFile(ROUTES_FILE, `${routes.join('\n')}\n`, 'utf8');
  console.log(`[prerender] ${routes.length} rutas escritas en prerender-routes.txt.`);
}

main().catch(error => {
  console.error('[prerender] Error inesperado al escribir la lista de rutas:', error);
  process.exitCode = 1;
});
