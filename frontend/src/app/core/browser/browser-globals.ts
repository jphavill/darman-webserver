import { InjectionToken } from '@angular/core';

export const WINDOW = new InjectionToken<Window>('WINDOW', {
  factory: () => window
});

export const BROWSER_STORAGE = new InjectionToken<Storage>('BROWSER_STORAGE', {
  factory: () => localStorage
});
