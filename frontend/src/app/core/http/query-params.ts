import { HttpParams } from '@angular/common/http';

type QueryValue = string | number | boolean | null | undefined;

export function buildHttpParams<T extends object>(query: T): HttpParams {
  let params = new HttpParams();

  Object.entries(query as Record<string, QueryValue>).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    params = params.set(key, String(value));
  });

  return params;
}
