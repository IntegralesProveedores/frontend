/** Presentaciones que se venden solo desde su landing (no aparecen en la ficha del producto). */
export interface LandingVariant {
  slug: string;
  units: number;
  path: string;
}

export const OLIVO_PACK: LandingVariant = {
  slug: 'olivo',
  units: 24,
  path: '/olivo/pack',
};

export const LANDING_VARIANTS: LandingVariant[] = [OLIVO_PACK];

export function findLandingVariant(
  slug: string | null | undefined,
  units: number | null | undefined,
): LandingVariant | undefined {
  return LANDING_VARIANTS.find((l) => l.slug === slug && l.units === Number(units));
}

/** Enlace a la ficha de un producto o, si es una presentación de landing, a su landing. */
export function productLink(
  slug: string,
  unitsPerPack?: number | null,
): (string | number)[] {
  const landing = findLandingVariant(slug, unitsPerPack);
  if (landing) return [landing.path];
  return unitsPerPack ? ['/productos', slug, unitsPerPack] : ['/productos', slug];
}
