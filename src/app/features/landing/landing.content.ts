import { OLIVO_PACK } from '../../core/lib/landing-variants';

export const PRODUCT_SLUG = OLIVO_PACK.slug;
/** Presentación que vende la landing (units_per_pack de la variante en la base de datos). */
export const PACK_UNITS = OLIVO_PACK.units;
export const PAGE_PATH = OLIVO_PACK.path;

/** Fotos del pack (van primero en la galería y son la foto del ítem en el carrito). */
export const PACK_IMAGES = [
  '/assets/images/producto-maceta-biodegradable-olivo-pack-00.webp',
  '/assets/images/producto-maceta-biodegradable-olivo-pack-01.webp',
];
export const PAGE_URL = `https://brotalia.com.ar${PAGE_PATH}`;

/** Secciones opcionales: se muestran solo cuando tienen datos. */
export const VIDEO_URL = '';
export const CERTIFICACIONES: { nombre: string; detalle: string }[] = [];
export const REDES: { nombre: string; url: string; icono: string }[] = [];

export const MATERIALES = [
  ['Turba', 'Retiene la humedad y aporta un sustrato liviano y aireado.'],
  ['Papel', 'Fibra celulósica que le da forma y resistencia a la maceta.'],
  ['Cartón', 'Refuerza la estructura y se degrada junto con el resto.'],
];

export const SOSTENIBILIDAD = [
  ['100% biodegradable', 'La maceta se transforma en materia orgánica al contacto con la tierra.'],
  ['Sin residuos plásticos', 'No queda nada para retirar ni descartar después de plantar.'],
  ['Sin stress de trasplante', 'Se planta la maceta entera, sin tocar la raíz.'],
  ['Mejor crecimiento radicular', 'Genera un sistema de raíces más denso y activo.'],
];
