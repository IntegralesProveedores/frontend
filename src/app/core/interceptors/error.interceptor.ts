import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      if (environment.production) {
        console.error(`[API Error] ${req.method} ${req.url}`);
      } else {
        console.error(`[API Error] ${req.method} ${req.url}`, err);
      }
      return throwError(() => err);
    }),
  );
};
