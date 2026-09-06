/**
 * Suma días hábiles (lunes a viernes) a una fecha. No contempla feriados:
 * el pedido explícito era una estimación simple, no un calendario de feriados.
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) remaining--;
  }
  return result;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
});

/**
 * Rango estimado de entrega para el envío "clásico" (2 a 5 días hábiles por
 * defecto). Devuelve un texto tipo "Entre el 8 y el 12 de septiembre".
 */
export function getEstimatedDeliveryRangeLabel(
  minDays = 2,
  maxDays = 5,
  from: Date = new Date(),
): string {
  const start = addBusinessDays(from, minDays);
  const end = addBusinessDays(from, maxDays);

  if (start.getMonth() === end.getMonth()) {
    return `Entre el ${start.getDate()} y el ${DATE_FORMATTER.format(end)}`;
  }
  return `Entre el ${DATE_FORMATTER.format(start)} y el ${DATE_FORMATTER.format(end)}`;
}
