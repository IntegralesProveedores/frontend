function normalizeProvinceName(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isCabaProvince(value: string | null | undefined): boolean {
  const p = normalizeProvinceName(value);
  return p === 'ciudad autonoma de buenos aires' || p === 'caba';
}

export function isBuenosAiresProvince(
  value: string | null | undefined,
): boolean {
  const p = normalizeProvinceName(value);
  return (
    p === 'buenos aires' ||
    p === 'provincia de buenos aires' ||
    p === 'pcia. de buenos aires' ||
    p === 'pcia de buenos aires'
  );
}
