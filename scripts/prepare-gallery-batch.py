#!/usr/bin/env python3

import argparse
import csv
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".heic"}
METADATA_FIELDNAMES = ["filename", "id", "alt_text", "caption", "captured_at", "is_published"]


@dataclass
class MetadataRow:
    filename: str
    photo_id: str
    alt_text: str
    caption: str
    captured_at: datetime
    is_published: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate gallery images for all files listed in a metadata CSV (resized thumbnails + full-size originals)."
    )
    parser.add_argument("--input-dir", required=True, help="Directory containing source photos")
    parser.add_argument("--metadata", required=True, help="CSV with filename,id,alt_text,caption,captured_at,is_published")
    parser.add_argument("--thumb-width", type=int, default=640, help="Max width for thumbnail images")
    parser.add_argument("--thumb-quality", type=int, default=82, help="WebP quality for thumbnails (0-100)")
    parser.add_argument("--full-quality", type=int, default=95, help="WebP quality for full-size images (0-100)")
    parser.add_argument("--media-dir", default="media/gallery", help="Output media directory")
    parser.add_argument("--manifest-out", default="media/gallery-manifest.json", help="Output JSON manifest for API upsert")
    parser.add_argument(
        "--metadata-out",
        default="",
        help="Optional output CSV with generated UUIDs. Defaults to <metadata>.resolved.csv",
    )
    return parser.parse_args()


def slugify(name: str) -> str:
    slug = []
    for ch in name.lower():
        if ch.isalnum():
            slug.append(ch)
        else:
            slug.append("-")
    value = "".join(slug)
    while "--" in value:
        value = value.replace("--", "-")
    return value.strip("-") or "photo"


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "y"}


def parse_captured_at(value: str, filename: str) -> datetime:
    candidate = value.strip()
    if not candidate:
        raise ValueError(f"Row for {filename} is missing captured_at")

    normalized = candidate.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"Row for {filename} has invalid captured_at: {candidate}") from exc

    if parsed.tzinfo is None:
        raise ValueError(f"Row for {filename} captured_at must include timezone offset: {candidate}")
    return parsed


def read_metadata(metadata_path: Path) -> list[MetadataRow]:
    rows: list[MetadataRow] = []
    with metadata_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"filename", "alt_text", "caption"}
        missing = [column for column in required if column not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"Metadata CSV missing required columns: {', '.join(missing)}")

        for source_row in reader:
            filename = (source_row.get("filename") or "").strip()
            alt_text = (source_row.get("alt_text") or "").strip()
            caption = (source_row.get("caption") or "").strip()
            if not filename:
                continue
            if not alt_text or not caption:
                raise ValueError(f"Row for {filename} is missing alt_text or caption")

            raw_id = (source_row.get("id") or "").strip()
            photo_id = str(uuid.UUID(raw_id)) if raw_id else str(uuid.uuid4())

            raw_captured_at = (source_row.get("captured_at") or "").strip()
            captured_at = parse_captured_at(raw_captured_at, filename)

            raw_published = (source_row.get("is_published") or "true").strip()
            is_published = parse_bool(raw_published)

            rows.append(
                MetadataRow(
                    filename=filename,
                    photo_id=photo_id,
                    alt_text=alt_text,
                    caption=caption,
                    captured_at=captured_at,
                    is_published=is_published,
                )
            )

    if not rows:
        raise ValueError("Metadata CSV did not contain any usable rows")

    return rows


def run_command(command: list[str]) -> None:
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{completed.stderr}")


def process_image(
    source_path: Path,
    output_path: Path,
    width: Optional[int],
    quality: int,
    magick_path: Optional[str],
    has_docker: bool,
) -> None:
    resize_args = ["-resize", f"{width}x>"] if width is not None else []

    if magick_path:
        run_command(
            [
                magick_path,
                str(source_path),
                "-auto-orient",
                "-strip",
                *resize_args,
                "-quality",
                str(quality),
                str(output_path),
            ]
        )
        return

    if not has_docker:
        raise RuntimeError("Install ImageMagick (magick) or Docker to process images.")

    run_command(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{source_path.parent}:/input:ro",
            "-v",
            f"{output_path.parent}:/output",
            "dpokidov/imagemagick",
            f"/input/{source_path.name}",
            "-auto-orient",
            "-strip",
            *resize_args,
            "-quality",
            str(quality),
            f"/output/{output_path.name}",
        ]
    )


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(8192)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()[:12]


def write_resolved_metadata(path: Path, rows: list[MetadataRow]) -> None:
    merged: dict[str, MetadataRow] = {}
    order: list[str] = []

    def row_key(filename: str, photo_id: str) -> str:
        if photo_id.strip():
            return f"id:{photo_id.strip()}"
        return f"filename:{filename.strip().lower()}"

    if path.exists():
        with path.open("r", encoding="utf-8", newline="") as existing_handle:
            reader = csv.DictReader(existing_handle)
            missing = [column for column in METADATA_FIELDNAMES if column not in (reader.fieldnames or [])]
            if missing:
                raise ValueError(f"Resolved metadata CSV missing required columns: {', '.join(missing)}")

            for source_row in reader:
                filename = (source_row.get("filename") or "").strip()
                if not filename:
                    continue

                photo_id = (source_row.get("id") or "").strip()
                alt_text = (source_row.get("alt_text") or "").strip()
                caption = (source_row.get("caption") or "").strip()
                raw_captured_at = (source_row.get("captured_at") or "").strip()
                captured_at = parse_captured_at(raw_captured_at, filename)
                raw_published = (source_row.get("is_published") or "true").strip()
                is_published = parse_bool(raw_published)

                key = row_key(filename=filename, photo_id=photo_id)
                if key not in merged:
                    order.append(key)
                merged[key] = MetadataRow(
                    filename=filename,
                    photo_id=photo_id,
                    alt_text=alt_text,
                    caption=caption,
                    captured_at=captured_at,
                    is_published=is_published,
                )

    for row in rows:
        key = row_key(filename=row.filename, photo_id=row.photo_id)
        if key not in merged:
            order.append(key)
        merged[key] = row

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=METADATA_FIELDNAMES,
        )
        writer.writeheader()
        for key in order:
            row = merged[key]
            writer.writerow(
                {
                    "filename": row.filename,
                    "id": row.photo_id,
                    "alt_text": row.alt_text,
                    "caption": row.caption,
                    "captured_at": row.captured_at.isoformat(),
                    "is_published": "true" if row.is_published else "false",
                }
            )


def merge_manifest_rows(manifest_path: Path, new_rows: list[dict[str, object]]) -> list[dict[str, object]]:
    merged: dict[str, dict[str, object]] = {}
    order: list[str] = []

    if manifest_path.exists():
        with manifest_path.open("r", encoding="utf-8") as existing_handle:
            existing_payload = json.load(existing_handle)

        if not isinstance(existing_payload, dict):
            raise ValueError("Existing manifest JSON must be an object with a 'rows' array")

        existing_rows = existing_payload.get("rows", [])
        if not isinstance(existing_rows, list):
            raise ValueError("Existing manifest JSON field 'rows' must be an array")

        for row in existing_rows:
            if not isinstance(row, dict):
                raise ValueError("Existing manifest rows must be objects")
            photo_id = str(row.get("id", "")).strip()
            if not photo_id:
                raise ValueError("Existing manifest row missing required 'id'")
            if photo_id not in merged:
                order.append(photo_id)
            merged[photo_id] = row

    for row in new_rows:
        photo_id = str(row.get("id", "")).strip()
        if not photo_id:
            raise ValueError("Generated manifest row missing required 'id'")
        if photo_id not in merged:
            order.append(photo_id)
        merged[photo_id] = row

    return [merged[photo_id] for photo_id in order]


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    metadata_path = Path(args.metadata).resolve()
    media_dir = Path(args.media_dir).resolve()
    manifest_path = Path(args.manifest_out).resolve()
    metadata_out = Path(args.metadata_out).resolve() if args.metadata_out else metadata_path.with_suffix(".resolved.csv")

    if not input_dir.exists() or not input_dir.is_dir():
        raise RuntimeError(f"Input directory does not exist: {input_dir}")
    if not metadata_path.exists():
        raise RuntimeError(f"Metadata CSV does not exist: {metadata_path}")
    if not 0 <= args.thumb_quality <= 100:
        raise RuntimeError(f"--thumb-quality must be between 0 and 100: {args.thumb_quality}")
    if not 0 <= args.full_quality <= 100:
        raise RuntimeError(f"--full-quality must be between 0 and 100: {args.full_quality}")

    media_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    metadata_rows = read_metadata(metadata_path)
    magick_path = shutil.which("magick")
    has_docker = shutil.which("docker") is not None

    manifest_rows = []

    with tempfile.TemporaryDirectory() as tmp_name:
        tmp_dir = Path(tmp_name)
        for row in metadata_rows:
            source_path = input_dir / row.filename
            if not source_path.exists():
                raise RuntimeError(f"Missing source file from metadata: {source_path}")
            if source_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                raise RuntimeError(f"Unsupported file extension for {source_path.name}")

            slug = slugify(source_path.stem)
            id_prefix = row.photo_id.split("-")[0]

            thumb_tmp = tmp_dir / f"{slug}-{id_prefix}-thumb.webp"
            full_tmp = tmp_dir / f"{slug}-{id_prefix}-full.webp"

            process_image(
                source_path=source_path,
                output_path=thumb_tmp,
                width=args.thumb_width,
                quality=args.thumb_quality,
                magick_path=magick_path,
                has_docker=has_docker,
            )
            process_image(
                source_path=source_path,
                output_path=full_tmp,
                width=None,
                quality=args.full_quality,
                magick_path=magick_path,
                has_docker=has_docker,
            )

            thumb_hash = hash_file(thumb_tmp)
            full_hash = hash_file(full_tmp)

            thumb_name = f"{slug}-{id_prefix}.thumb-{thumb_hash}.webp"
            full_name = f"{slug}-{id_prefix}.full-{full_hash}.webp"

            thumb_dest = media_dir / thumb_name
            full_dest = media_dir / full_name

            shutil.copy2(thumb_tmp, thumb_dest)
            shutil.copy2(full_tmp, full_dest)

            manifest_rows.append(
                {
                    "id": row.photo_id,
                    "alt_text": row.alt_text,
                    "caption": row.caption,
                    "thumb_url": f"/media/gallery/{thumb_name}",
                    "full_url": f"/media/gallery/{full_name}",
                    "captured_at": row.captured_at.isoformat(),
                    "is_published": row.is_published,
                }
            )

            print(f"Processed {row.filename} -> {thumb_name}, {full_name}")

    merged_manifest_rows = merge_manifest_rows(manifest_path, manifest_rows)

    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump({"rows": merged_manifest_rows}, handle, indent=2)
        handle.write("\n")

    write_resolved_metadata(metadata_out, metadata_rows)

    print(f"Manifest written: {manifest_path}")
    print(f"Manifest rows: {len(merged_manifest_rows)} (new/updated in this batch: {len(manifest_rows)})")
    print(f"Resolved metadata written: {metadata_out}")
    print(f"Next: scp {media_dir}/* jh://home/jphavill/dockerStuff/darman-webserver/media/gallery/")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
