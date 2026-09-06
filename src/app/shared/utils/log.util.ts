import { environment } from '../../../environments/environment';

/**
 * console.error que en producción omite el objeto de error completo (puede
 * traer datos del usuario ecoados en el body de una respuesta HTTP fallida),
 * y en desarrollo lo muestra entero para debug.
 */
export function logError(message: string, err?: unknown): void {
  if (environment.production) {
    console.error(message);
  } else {
    console.error(message, err);
  }
}
