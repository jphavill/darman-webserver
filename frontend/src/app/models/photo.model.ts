export interface PhotoApi {
  id: string;
  alt_text: string;
  caption: string;
  thumb_url: string;
  full_url: string;
  captured_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  altText: string;
  caption: string;
  thumbUrl: string;
  fullUrl: string;
  capturedAt: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoListResponseApi {
  rows: PhotoApi[];
  total: number;
}

export interface PhotoListResponse {
  rows: Photo[];
  total: number;
}

export function mapPhotoApiToPhoto(photo: PhotoApi): Photo {
  return {
    id: photo.id,
    altText: photo.alt_text,
    caption: photo.caption,
    thumbUrl: photo.thumb_url,
    fullUrl: photo.full_url,
    capturedAt: photo.captured_at,
    isPublished: photo.is_published,
    createdAt: photo.created_at,
    updatedAt: photo.updated_at
  };
}
