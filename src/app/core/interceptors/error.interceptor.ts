import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { logError } from '../../shared/utils/log.util';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      logError(`[API Error] ${req.method} ${req.url}`, err);
      return throwError(() => err);
    }),
  );
};
