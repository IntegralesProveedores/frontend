export type ImageVariant = 'thumb' | 'md';

/** Variante liviana de una imagen local (`-thumb.webp` 200px, `-md.webp` 640px). */
export function imageVariant(url: string, variant: ImageVariant): string {
  return url.startsWith('/assets/images/')
    ? url.replace(/\.(webp|jpe?g|png)$/i, `-${variant}.webp`)
    : url;
}

/** Si la variante no existe, vuelve a la imagen original (una sola vez). */
export function fallbackToOriginal(event: Event, original: string): void {
  const img = event.target as HTMLImageElement;
  if (original && !img.src.endsWith(original)) img.src = original;
}
