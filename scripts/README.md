# Photo Upload Scripts

This folder contains scripts for preparing gallery images and syncing metadata to the API.

## Scripts

- `prepare-gallery-batch.py`
  - Processes many images from one directory.
  - Generates two variants per image:
    - thumbnail (for gallery grid)
    - full-size (for modal/fullscreen)
  - Writes an API manifest JSON and a resolved metadata CSV (with UUIDs).

- `upsert-gallery-manifest.sh`
  - Sends the generated manifest to `POST /api/v1/photos/batch-upsert`.

## Prerequisites

- Python 3
- ImageMagick (`magick`) **or** Docker
- Running API (`/api/v1/photos/batch-upsert`)
- Valid `ADMIN_API_TOKEN`

## 1) Prepare metadata CSV

Create a CSV file (for example `metadata.csv`) with this header:

```csv
filename,id,alt_text,caption,sort_order,is_published
IMG_1001.JPG,,Fog over the valley,Morning inversion near the ridge,10,true
IMG_1002.JPG,,Workbench detail,New fixture test fit,20,true
```

Notes:

- `filename` must match a file in your input directory.
- `id` may be empty on first run. The script will generate UUIDs.
- Keep the generated IDs for future updates so the same logical photo is updated.

## 2) Generate thumbnail + full images

Run from repo root:

```bash
./scripts/prepare-gallery-batch.py \
  --input-dir ~/Pictures/gallery-upload \
  --metadata ~/Pictures/gallery-upload/metadata.csv \
  --thumb-width 640 \
  --full-width 2560 \
  --manifest-out ./media/gallery-manifest.json
```

Outputs:

- Processed images in `media/gallery/`
- API payload in `media/gallery-manifest.json`
- Resolved CSV (defaults to `metadata.resolved.csv`) with UUID IDs filled in

## 3) Copy images to server media folder

Example:

```bash
scp media/gallery/* jh://home/jphavill/dockerStuff/darman-webserver/media/gallery/
```

## 4) Upsert photo metadata into Postgres via API

```bash
./scripts/upsert-gallery-manifest.sh \
  ./media/gallery-manifest.json \
  "$ADMIN_API_TOKEN" \
  http://localhost/api
```

## Typical update workflow

1. Edit metadata CSV (captions/order/published flag).
2. Re-run `prepare-gallery-batch.py`.
3. Upload new/updated files with `scp`.
4. Run `upsert-gallery-manifest.sh`.

## Troubleshooting

- `Install ImageMagick (magick) or Docker to process images.`
  - Install `magick` or ensure Docker is running.

- `Missing source file from metadata`
  - Check `filename` values in CSV and input directory path.

- API returns `401` on upsert
  - Verify `ADMIN_API_TOKEN` value and `Authorization: Bearer` usage.

- API returns `422` on upsert
  - Validate UUID format, required text fields, and URL fields in manifest rows.
