import { Injectable, computed, signal } from '@angular/core';
import { AdminFeatureFlag, AdminFeatureFlags, DEFAULT_ADMIN_FEATURE_FLAGS } from './admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthStateService {
  private readonly isAuthenticatedSignal = signal(false);
  private readonly featureFlagsSignal = signal<AdminFeatureFlags>(DEFAULT_ADMIN_FEATURE_FLAGS);

  readonly isAuthenticated = computed(() => this.isAuthenticatedSignal());
  readonly featureFlags = computed(() => this.featureFlagsSignal());

  can(flag: AdminFeatureFlag): boolean {
    return this.featureFlagsSignal()[flag] === true;
  }

  setSession(featureFlags: AdminFeatureFlags): void {
    this.isAuthenticatedSignal.set(true);
    this.featureFlagsSignal.set(featureFlags);
  }

  clearSession(): void {
    this.isAuthenticatedSignal.set(false);
    this.featureFlagsSignal.set(DEFAULT_ADMIN_FEATURE_FLAGS);
  }
}
