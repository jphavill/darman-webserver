export interface Photo {
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

export interface PhotoListResponse {
  rows: Photo[];
  total: number;
}
