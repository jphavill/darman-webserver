import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AdminSessionService } from '../../core/admin/admin-session.service';
import { TopNavComponent } from './top-nav.component';

describe('TopNavComponent', () => {
  it('creates the component class', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminSessionService,
          useValue: {
            isAuthenticated: signal(false),
            isLoggingIn: signal(false),
            loginError: signal(''),
            logoutError: signal(''),
            clearLoginError: () => undefined,
            logout: () => undefined,
            login: () => of(false)
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new TopNavComponent());
    expect(component).toBeTruthy();
  });
});
