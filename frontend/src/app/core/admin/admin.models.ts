export type AdminFeatureFlag = 'photosViewUnpublished' | 'photosManagePublication';

export interface AdminFeatureFlags {
  photosViewUnpublished: boolean;
  photosManagePublication: boolean;
}

export interface AdminSessionResponseApi {
  feature_flags?: {
    photos_view_unpublished?: boolean;
    photos_manage_publication?: boolean;
  };
}

export interface AdminSession {
  featureFlags: AdminFeatureFlags;
}

export const DEFAULT_ADMIN_FEATURE_FLAGS: AdminFeatureFlags = {
  photosViewUnpublished: false,
  photosManagePublication: false
};

export function mapAdminSessionResponseApi(response: AdminSessionResponseApi): AdminSession {
  return {
    featureFlags: {
      photosViewUnpublished: response.feature_flags?.photos_view_unpublished === true,
      photosManagePublication: response.feature_flags?.photos_manage_publication === true
    }
  };
}
