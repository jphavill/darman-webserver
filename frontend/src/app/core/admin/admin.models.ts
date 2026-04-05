export type AdminFeatureFlag =
  | 'photosViewUnpublished'
  | 'photosManagePublication'
  | 'projectsViewUnpublished'
  | 'projectsManagePublication'
  | 'projectsManageContent';

export interface AdminFeatureFlags {
  photosViewUnpublished: boolean;
  photosManagePublication: boolean;
  projectsViewUnpublished: boolean;
  projectsManagePublication: boolean;
  projectsManageContent: boolean;
}

export interface AdminSessionResponseApi {
  feature_flags?: {
    photos_view_unpublished?: boolean;
    photos_manage_publication?: boolean;
    projects_view_unpublished?: boolean;
    projects_manage_publication?: boolean;
    projects_manage_content?: boolean;
  };
}

export interface AdminSession {
  featureFlags: AdminFeatureFlags;
}

export const DEFAULT_ADMIN_FEATURE_FLAGS: AdminFeatureFlags = {
  photosViewUnpublished: false,
  photosManagePublication: false,
  projectsViewUnpublished: false,
  projectsManagePublication: false,
  projectsManageContent: false
};

export function mapAdminSessionResponseApi(response: AdminSessionResponseApi): AdminSession {
  return {
    featureFlags: {
      photosViewUnpublished: response.feature_flags?.photos_view_unpublished === true,
      photosManagePublication: response.feature_flags?.photos_manage_publication === true,
      projectsViewUnpublished: response.feature_flags?.projects_view_unpublished === true,
      projectsManagePublication: response.feature_flags?.projects_manage_publication === true,
      projectsManageContent: response.feature_flags?.projects_manage_content === true
    }
  };
}
