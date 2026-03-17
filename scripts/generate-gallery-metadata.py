#!/usr/bin/env python3

import argparse
import csv
import os
import subprocess
from datetime import datetime
from pathlib import Path


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".heic"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a metadata CSV from photos in a directory, ordered by newest ItemContentCreationDate first."
    )
    parser.add_argument("--input-dir", required=True, help="Directory containing source photos")
    parser.add_argument(
        "--output-name",
        default="metadata.csv",
        help="Output CSV filename created inside --input-dir (default: metadata.csv)",
    )
    return parser.parse_args()


def get_filesystem_timestamp(path: Path) -> float:
    stat = path.stat()
    if hasattr(stat, "st_birthtime"):
        return stat.st_birthtime
    return stat.st_mtime


def get_item_content_creation_datetime(path: Path) -> datetime:
    result = subprocess.run(
        ["mdls", "-raw", "-name", "kMDItemContentCreationDate", str(path)],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        value = result.stdout.strip()
        if value and value != "(null)":
            try:
                return datetime.strptime(value, "%Y-%m-%d %H:%M:%S %z")
            except ValueError:
                pass

    return datetime.fromtimestamp(get_filesystem_timestamp(path)).astimezone()


def list_photo_rows(input_dir: Path) -> list[tuple[Path, datetime]]:
    rows = [
        (path, get_item_content_creation_datetime(path))
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    rows.sort(key=lambda item: (item[1].timestamp(), item[0].name.lower()), reverse=True)
    return rows


def write_metadata_csv(output_path: Path, photo_rows: list[tuple[Path, datetime]]) -> None:
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["filename", "id", "alt_text", "caption", "captured_at", "is_published"],
        )
        writer.writeheader()
        for photo, captured_at in photo_rows:
            writer.writerow(
                {
                    "filename": photo.name,
                    "id": "",
                    "alt_text": "",
                    "caption": "",
                    "captured_at": captured_at.isoformat(),
                    "is_published": "true",
                }
            )


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_name = os.path.basename(args.output_name)
    output_path = input_dir / output_name

    if not input_dir.exists() or not input_dir.is_dir():
        raise RuntimeError(f"Input directory does not exist: {input_dir}")

    photo_rows = list_photo_rows(input_dir)
    if not photo_rows:
        raise RuntimeError(f"No supported image files found in: {input_dir}")

    write_metadata_csv(output_path=output_path, photo_rows=photo_rows)

    print(f"Metadata created: {output_path}")
    print(f"Rows written: {len(photo_rows)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}")
        raise SystemExit(1)
