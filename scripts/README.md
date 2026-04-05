# Photo Upload Scripts

This folder contains scripts for preparing gallery images and syncing metadata to the API.

## Scripts

- `generate-gallery-metadata.py`
  - Scans a directory of photos and creates a metadata CSV in that same directory.
  - Creates rows with fields from `metadata.template.csv`.
  - Leaves `id`, `alt_text`, and `caption` empty.
  - Sets `is_published` to `true`.
  - Sorts rows by `kMDItemContentCreationDate` metadata (newest first).
  - Writes `captured_at` as an ISO-8601 timestamp with timezone.

- `prepare-gallery-batch.py`
  - Processes many images from one directory.
  - Generates two variants per image:
    - thumbnail (for gallery grid, resized by `--thumb-width`, default quality `82`)
    - full-size (for modal/fullscreen, keeps original resolution, default quality `95`)
  - Writes an API manifest JSON and a resolved metadata CSV (with UUIDs).
  - If `--manifest-out` already exists, rows are merged by `id` (new IDs append, existing IDs update in place).

- `upsert-gallery-manifest.sh`
  - Logs in with `ADMIN_API_TOKEN`, sends the manifest to `POST /api/v1/photos/batch-upsert` with cookie + CSRF auth, then logs out.

## Prerequisites

- Python 3
- ImageMagick (`magick`) **or** Docker
- Running API (`/api/v1/photos/batch-upsert`)
- Valid `ADMIN_API_TOKEN`

## 1 Prepare metadata CSV

Option A: generate metadata automatically from a photo directory:

```bash
./scripts/generate-gallery-metadata.py \
  --input-dir ~/Pictures/gallery-upload
```

This creates `~/Pictures/gallery-upload/metadata.csv`.

Optional flags:

- `--output-name metadata.csv` to change the output filename (still created in `--input-dir`)

Option B: create CSV manually.

Create a CSV file (for example `metadata.csv`) with this header:

```csv
filename,id,alt_text,caption,captured_at,is_published
IMG_1001.JPG,,Fog over the valley,Morning inversion near the ridge,2026-03-16T09:45:00-07:00,true
IMG_1002.JPG,,Workbench detail,New fixture test fit,2026-03-15T18:22:00-07:00,true
```

Notes:

- `filename` must match a file in your input directory.
- `id` may be empty on first run. The script will generate UUIDs.
- Keep the generated IDs for future updates so the same logical photo is updated.

## 2 Generate thumbnail + full images

Run from repo root:

```bash
./scripts/prepare-gallery-batch.py \
  --input-dir ~/Pictures/gallery-upload \
  --metadata ~/Pictures/gallery-upload/metadata.csv \
  --thumb-width 640 \
  --thumb-quality 82 \
  --full-quality 95 \
  --manifest-out ./media/gallery-manifest.json
```

Outputs:

- Processed images in `media/gallery/`
- API payload in `media/gallery-manifest.json` (merged/upserted by `id` if file already exists)
- Resolved CSV (defaults to `metadata.resolved.csv`) with UUID IDs filled in (merged/upserted if file already exists)

## 3 Copy images to server media folder

Example:

```bash
scp media/gallery/* jh://home/jphavill/dockerStuff/darman-webserver/media/gallery/
```

## 4 Upsert photo metadata into Postgres via API

```bash
./scripts/upsert-gallery-manifest.sh \
  ./media/gallery-manifest.json \
  "$ADMIN_API_TOKEN" \
  http://localhost/api
```

## Typical update workflow

1. Edit metadata CSV (captions/captured date/published flag).
2. Re-run `prepare-gallery-batch.py`.
3. Upload new/updated files with `scp`.
4. Run `upsert-gallery-manifest.sh`.

## Troubleshooting

- `Install ImageMagick (magick) or Docker to process images.`
  - Install `magick` or ensure Docker is running.

- `Missing source file from metadata`
  - Check `filename` values in CSV and input directory path.

- API returns `401` on upsert
  - Verify `ADMIN_API_TOKEN` and that `POST /api/v1/system/admin/session` succeeds for your `api-base-url`.

- API returns `403` on upsert
  - The session cookie or CSRF token was not accepted. Re-run `upsert-gallery-manifest.sh` to establish a fresh admin session.

- API returns `422` on upsert
  - Validate UUID format, required text fields, and URL fields in manifest rows.
