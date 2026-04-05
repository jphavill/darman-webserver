import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminAuthStateService } from './admin-auth-state.service';
import { AdminSessionService } from './admin-session.service';

describe('AdminSessionService', () => {
  let service: AdminSessionService;
  let authState: AdminAuthStateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminSessionService, AdminAuthStateService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminSessionService);
    authState = TestBed.inject(AdminAuthStateService);
    httpMock = TestBed.inject(HttpTestingController);

    const bootstrap = httpMock.expectOne('/api/v1/system/admin/session');
    bootstrap.flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('logs in with API key and stores feature flags', () => {
    service.login(' secret ').subscribe((isLoggedIn) => {
      expect(isLoggedIn).toBe(true);
    });

    const request = httpMock.expectOne('/api/v1/system/admin/session');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ api_key: 'secret' });
    request.flush({
      feature_flags: {
        photos_view_unpublished: true,
        photos_manage_publication: true
      }
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(authState.can('photosViewUnpublished')).toBe(true);
  });

  it('refresh clears auth state on unauthorized session', () => {
    authState.setSession({ photosViewUnpublished: true, photosManagePublication: true });

    service.refreshSession().subscribe((isLoggedIn) => {
      expect(isLoggedIn).toBe(false);
    });

    const request = httpMock.expectOne('/api/v1/system/admin/session');
    expect(request.request.method).toBe('GET');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout clears auth state when server revoke succeeds', () => {
    authState.setSession({ photosViewUnpublished: true, photosManagePublication: true });

    service.logout();

    const revokeRequest = httpMock.expectOne('/api/v1/system/admin/session');
    expect(revokeRequest.request.method).toBe('DELETE');
    revokeRequest.flush({}, { status: 204, statusText: 'No Content' });

    const refreshRequest = httpMock.expectOne('/api/v1/system/admin/session');
    expect(refreshRequest.request.method).toBe('GET');
    refreshRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.logoutError()).toBe('');
  });

  it('logout keeps auth state and surfaces error when session remains active', () => {
    authState.setSession({ photosViewUnpublished: true, photosManagePublication: true });

    service.logout();

    const revokeRequest = httpMock.expectOne('/api/v1/system/admin/session');
    expect(revokeRequest.request.method).toBe('DELETE');
    revokeRequest.flush({}, { status: 403, statusText: 'Forbidden' });

    const refreshRequest = httpMock.expectOne('/api/v1/system/admin/session');
    expect(refreshRequest.request.method).toBe('GET');
    refreshRequest.flush({
      feature_flags: {
        photos_view_unpublished: true,
        photos_manage_publication: true
      }
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.logoutError()).toBe('Unable to log out. Please try again.');
  });
});
