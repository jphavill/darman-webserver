import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  Project,
  ProjectApi,
  ProjectCreatePayload,
  ProjectImageApi,
  ProjectImageUploadPayload,
  ProjectListResponse,
  ProjectListResponseApi,
  mapProjectApiToProject
} from '../models/project.model';
import { buildHttpParams } from '../core/http/query-params';

@Injectable({
  providedIn: 'root'
})
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  getProjects(type?: 'software' | 'physical', includeUnpublished = false): Observable<ProjectListResponse> {
    const params = buildHttpParams({ type, include_unpublished: includeUnpublished });
    return this.http.get<ProjectListResponseApi>('/api/v1/projects', { params }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapProjectApiToProject)
      }))
    );
  }

  createProject(payload: ProjectCreatePayload): Observable<Project> {
    return this.http.post<ProjectApi>('/api/v1/projects', payload).pipe(map(mapProjectApiToProject));
  }

  updateProject(projectId: string, payload: Partial<ProjectCreatePayload>): Observable<Project> {
    return this.http.patch<ProjectApi>(`/api/v1/projects/${projectId}`, payload).pipe(map(mapProjectApiToProject));
  }

  reorderProjects(type: 'software' | 'physical', projectIds: string[]): Observable<ProjectListResponse> {
    return this.http.post<ProjectListResponseApi>('/api/v1/projects/reorder', { type, project_ids: projectIds }).pipe(
      map((response) => ({
        total: response.total,
        rows: response.rows.map(mapProjectApiToProject)
      }))
    );
  }

  uploadProjectImage(projectId: string, file: File, payload: ProjectImageUploadPayload): Observable<ProjectImageApi> {
    const form = new FormData();
    form.set('file', file);
    form.set('alt_text', payload.altText);
    form.set('caption', payload.caption ?? '');
    form.set('is_hero', String(payload.isHero));
    return this.http.post<ProjectImageApi>(`/api/v1/projects/${projectId}/images`, form);
  }

  reorderProjectImages(projectId: string, imageIds: string[]): Observable<ProjectImageApi[]> {
    return this.http.patch<ProjectImageApi[]>(`/api/v1/projects/${projectId}/images/reorder`, {
      image_ids: imageIds
    });
  }

  updateProjectImage(projectId: string, imageId: string, isHero: boolean): Observable<ProjectImageApi> {
    return this.http.patch<ProjectImageApi>(`/api/v1/projects/${projectId}/images/${imageId}`, { is_hero: isHero });
  }

  deleteProjectImage(projectId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/projects/${projectId}/images/${imageId}`);
  }
}
