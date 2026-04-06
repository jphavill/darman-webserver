import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthStateService } from '../../core/admin/admin-auth-state.service';
import { WINDOW } from '../../core/browser/browser-globals';
import { Photo } from '../../models/photo.model';
import { PhotoMetadataService } from '../../services/photo-metadata.service';
import { PhotoApiService } from '../../services/photo-api.service';
import { PhotosPageComponent } from './photos-page.component';

function createPhoto(id: string, caption: string, isPublished = true): Photo {
  return {
    id,
    altText: caption,
    caption,
    thumbUrl: `/${id}-thumb.webp`,
    fullUrl: `/${id}-full.webp`,
    capturedAt: '2024-01-01T00:00:00+00:00',
    isPublished,
    createdAt: '2024-01-01T00:00:00+00:00',
    updatedAt: '2024-01-01T00:00:00+00:00'
  };
}

describe('PhotosPageComponent', () => {
  const adminCan = vi.fn((flag: string) => flag === 'photosManagePublication' || flag === 'photosViewUnpublished');
  const getPhotos = vi.fn();
  const uploadPhoto = vi.fn();
  const updatePhoto = vi.fn();
  const deletePhoto = vi.fn();
  const detectCapturedAtLocal = vi.fn();

  beforeEach(async () => {
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:preview') });
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn() });
    }

    vi.spyOn(URL, 'createObjectURL').mockImplementation((file: Blob) => `blob:${(file as File).name}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    getPhotos.mockReset();
    uploadPhoto.mockReset();
    updatePhoto.mockReset();
    deletePhoto.mockReset();
    detectCapturedAtLocal.mockReset();
    adminCan.mockClear();

    getPhotos.mockReturnValue(of({ rows: [], total: 0 }));
    updatePhoto.mockImplementation((id: string, payload: { caption?: string; altText?: string; isPublished?: boolean }) => {
      const nextCaption = payload.caption ?? 'Photo';
      const nextIsPublished = payload.isPublished ?? true;
      const mapped = createPhoto(id, nextCaption, nextIsPublished);
      return of({ ...mapped, altText: payload.altText ?? mapped.altText });
    });
    deletePhoto.mockReturnValue(of(void 0));
    detectCapturedAtLocal.mockResolvedValue({ value: '', source: 'No date found (optional field)' });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: PhotoApiService,
          useValue: {
            getPhotos,
            uploadPhoto,
            updatePhoto,
            deletePhoto
          }
        },
        {
          provide: PhotoMetadataService,
          useValue: {
            detectCapturedAtLocal
          }
        },
        {
          provide: AdminAuthStateService,
          useValue: {
            can: adminCan
          }
        },
        {
          provide: WINDOW,
          useValue: window
        },
        {
          provide: DOCUMENT,
          useValue: document
        }
      ]
    });

    await TestBed.compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('loads photos on init', async () => {
    const firstPhoto = createPhoto('1', 'First');
    getPhotos.mockReturnValueOnce(of({ rows: [firstPhoto], total: 1 }));

    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());

    await vi.waitFor(() => {
      expect(component.photos).toEqual([firstPhoto]);
    });
  });

  it('queues files with defaults and metadata date detection', async () => {
    detectCapturedAtLocal
      .mockResolvedValueOnce({ value: '2026-04-05T10:30', source: 'Auto from file metadata' })
      .mockResolvedValueOnce({ value: '2026-04-06T09:15', source: 'Auto from file modified time' });

    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const first = new File(['a'], 'ridge_sunrise.jpg', { type: 'image/jpeg', lastModified: 123 });
    const second = new File(['b'], 'shop-light.png', { type: 'image/png', lastModified: 456 });

    await (component as any).addQueuedUploads([first, second]);

    expect(component.queuedUploads).toHaveLength(2);
    expect(component.queuedUploads[0].caption).toBe('ridge sunrise');
    expect(component.queuedUploads[0].capturedAtLocal).toBe('2026-04-05T10:30');
    expect(component.queuedUploads[0].captureDateSource).toBe('Auto from file metadata');
    expect(component.queuedUploads[1].captureDateSource).toBe('Auto from file modified time');
    expect(component.queuedUploads[0].isPublished).toBe(true);
  });

  it('tracks upload statuses and supports retrying failed items', async () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    component.queuedUploads = [
      {
        id: 'upload-1',
        file: new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: 1 }),
        previewUrl: 'blob:a.jpg',
        caption: 'A',
        altText: '',
        capturedAtLocal: '2026-04-05T10:30',
        captureDateSource: 'Auto from file metadata',
        isPublished: true,
        status: 'queued',
        errorMessage: ''
      },
      {
        id: 'upload-2',
        file: new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: 2 }),
        previewUrl: 'blob:b.jpg',
        caption: 'B',
        altText: '',
        capturedAtLocal: '',
        captureDateSource: 'No date found (optional field)',
        isPublished: true,
        status: 'queued',
        errorMessage: ''
      }
    ];

    uploadPhoto
      .mockReturnValueOnce(throwError(() => new Error('bad upload')))
      .mockReturnValueOnce(of(createPhoto('2', 'B')));
    getPhotos.mockReturnValue(of({ rows: [createPhoto('2', 'B')], total: 1 }));

    await component.uploadQueuedPhotos();

    expect(component.queuedUploads[0].status).toBe('failed');
    expect(component.queuedUploads[1].status).toBe('uploaded');
    expect(component.errorMessage).toBe('Some uploads failed. You can edit and retry failed items.');
    expect(component.uploadStatusMessage).toBe('Uploaded 1, failed 1.');

    uploadPhoto.mockReturnValueOnce(of(createPhoto('1', 'A')));
    getPhotos.mockReturnValue(of({ rows: [createPhoto('1', 'A'), createPhoto('2', 'B')], total: 2 }));

    await component.uploadQueuedPhotos();

    expect(component.queuedUploads[0].status).toBe('uploaded');
    expect(component.queuedUploads[1].status).toBe('uploaded');
    expect(component.uploadStatusMessage).toBe('Uploaded 1 photo.');
    expect(component.errorMessage).toBe('');
  });

  it('skips blank captions and sends expected upload payload fields', async () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const file = new File(['a'], 'ridge.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2026, 3, 5, 17, 30, 0) });
    component.queuedUploads = [
      {
        id: 'upload-1',
        file,
        previewUrl: 'blob:ridge.jpg',
        caption: '   ',
        altText: '',
        capturedAtLocal: '',
        captureDateSource: '',
        isPublished: true,
        status: 'queued',
        errorMessage: ''
      },
      {
        id: 'upload-2',
        file,
        previewUrl: 'blob:ridge.jpg',
        caption: ' Ridge line ',
        altText: '  Ridge alt  ',
        capturedAtLocal: '2026-04-05T10:30',
        captureDateSource: 'Auto from file metadata',
        isPublished: false,
        status: 'queued',
        errorMessage: ''
      }
    ];

    uploadPhoto.mockReturnValueOnce(of(createPhoto('2', 'Ridge line')));
    getPhotos.mockReturnValue(of({ rows: [createPhoto('2', 'Ridge line', false)], total: 1 }));

    await component.uploadQueuedPhotos();

    expect(component.queuedUploads[0].status).toBe('failed');
    expect(component.queuedUploads[0].errorMessage).toBe('Caption is required.');
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(uploadPhoto.mock.calls[0][1]).toEqual({
      caption: 'Ridge line',
      altText: 'Ridge alt',
      capturedAt: new Date('2026-04-05T10:30').toISOString(),
      clientLastModified: '2026-04-05T17:30:00.000Z',
      isPublished: false
    });
  });

  it('clears only completed uploads and keeps failed entries for retry', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    component.queuedUploads = [
      {
        id: 'upload-1',
        file: new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: 1 }),
        previewUrl: 'blob:a.jpg',
        caption: 'A',
        altText: '',
        capturedAtLocal: '',
        captureDateSource: '',
        isPublished: true,
        status: 'uploaded',
        errorMessage: ''
      },
      {
        id: 'upload-2',
        file: new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: 1 }),
        previewUrl: 'blob:b.jpg',
        caption: 'B',
        altText: '',
        capturedAtLocal: '',
        captureDateSource: '',
        isPublished: true,
        status: 'failed',
        errorMessage: 'Upload failed'
      }
    ];

    component.clearCompletedUploads();

    expect(component.queuedUploads).toHaveLength(1);
    expect(component.queuedUploads[0].id).toBe('upload-2');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.jpg');
  });

  it('opens edit modal with selected photo metadata', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'Gallery shot');

    component.openEditPhoto(existing, new MouseEvent('click'));

    expect(component.editingPhoto?.id).toBe('42');
    expect(component.editingCaption).toBe('Gallery shot');
    expect(component.editingAltText).toBe('Gallery shot');
  });

  it('saves edited caption and alt text', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'Original');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));
    component.editingCaption = 'Updated caption';
    component.editingAltText = 'Updated alt';

    component.saveEditedPhoto();

    expect(updatePhoto).toHaveBeenCalledWith('42', { caption: 'Updated caption', altText: 'Updated alt' });
    expect(component.photos[0].caption).toBe('Updated caption');
    expect(component.photos[0].altText).toBe('Updated alt');
    expect(component.editSuccessMessage).toBe('Photo details saved.');
  });

  it('allows empty alt text by falling back to caption', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'Original');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));
    component.editingCaption = 'Updated caption';
    component.editingAltText = '   ';

    component.saveEditedPhoto();

    expect(updatePhoto).toHaveBeenCalledWith('42', { caption: 'Updated caption', altText: 'Updated caption' });
  });

  it('shows save error when edit update fails', () => {
    updatePhoto.mockReturnValueOnce(throwError(() => new Error('bad save')));
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'Original');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));
    component.editingCaption = 'Updated caption';
    component.editingAltText = 'Updated alt';

    component.saveEditedPhoto();

    expect(component.editFailureMessage).toBe('Unable to update photo right now.');
    expect(component.editSuccessMessage).toBe('');
    expect(component.isUpdatingPhoto('42')).toBe(false);
  });

  it('blocks closing the edit modal while save is pending', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'Original');
    const pendingSave = new Subject<Photo>();
    updatePhoto.mockReturnValueOnce(pendingSave.asObservable());
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));
    component.editingCaption = 'Updated caption';
    component.editingAltText = 'Updated alt';

    component.saveEditedPhoto();
    component.requestCloseEditPhoto();
    component.onEscape();

    expect(component.editingPhoto?.id).toBe('42');
    expect(component.isEditingPhotoPending()).toBe(true);

    pendingSave.next({ ...existing, caption: 'Updated caption', altText: 'Updated alt' });
    pendingSave.complete();

    expect(component.isEditingPhotoPending()).toBe(false);
    expect(component.editingPhoto?.id).toBe('42');
  });

  it('uses inline confirmation before deleting', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'To delete');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));

    component.deleteEditedPhoto();

    expect(component.isDeleteConfirming).toBe(true);
    expect(deletePhoto).not.toHaveBeenCalled();

    component.cancelDeletePhoto();
    expect(component.isDeleteConfirming).toBe(false);
  });

  it('deletes photo from gallery when requested in edit modal', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'To delete');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));

    component.deleteEditedPhoto();
    component.deleteEditedPhoto();

    expect(deletePhoto).toHaveBeenCalledWith('42');
    expect(component.photos).toEqual([]);
    expect(component.editingPhoto).toBeNull();
  });

  it('shows delete error when delete fails', () => {
    deletePhoto.mockReturnValueOnce(throwError(() => new Error('bad delete')));
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'To delete');
    component.photos = [existing];
    component.openEditPhoto(existing, new MouseEvent('click'));

    component.deleteEditedPhoto();
    component.deleteEditedPhoto();

    expect(component.editFailureMessage).toBe('Unable to delete photo right now.');
    expect(component.isDeleteConfirming).toBe(false);
    expect(component.editingPhoto?.id).toBe('42');
  });

  it('closes active photo when deleted from edit modal', () => {
    const component = TestBed.runInInjectionContext(() => new PhotosPageComponent());
    const existing = createPhoto('42', 'To delete');
    component.photos = [existing];
    component.activePhoto = existing;
    component.openEditPhoto(existing, new MouseEvent('click'));

    component.deleteEditedPhoto();
    component.deleteEditedPhoto();

    expect(component.activePhoto).toBeNull();
  });

});
