from datetime import datetime, timezone
from dataclasses import dataclass
import logging
from pathlib import Path
import re
from uuid import UUID, uuid4

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core.errors import NotFoundAppError, ValidationAppError
from core.settings import get_settings
from core.text import collapse_whitespace
from models import Photo
from schemas import PhotoListResponse, PhotoRow, PhotoUpdateRequest, PhotoUploadRequest


ALLOWED_UPLOAD_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif", "tif", "tiff", "heic"}
EXIF_TAG_DATETIME = 306
EXIF_TAG_DATETIME_ORIGINAL = 36867
EXIF_TAG_CREATE_DATE = 36868
EXIF_TAG_OFFSET_TIME = 36880
EXIF_TAG_OFFSET_TIME_ORIGINAL = 36881
EXIF_TAG_OFFSET_TIME_DIGITIZED = 36882


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessedPhotoMedia:
    thumb_url: str
    full_url: str
    written_paths: tuple[Path, ...]


def list_photos(db: Session, limit: int, offset: int, include_unpublished: bool = False) -> PhotoListResponse:
    query = db.query(Photo)
    if not include_unpublished:
        query = query.filter(Photo.is_published.is_(True))

    query = query.order_by(Photo.captured_at.desc(), Photo.created_at.desc(), Photo.id.asc())

    total = query.count()
    records = query.offset(offset).limit(limit).all()

    rows = [_to_photo_row(record) for record in records]

    return PhotoListResponse(rows=rows, total=total)


def upload_photo(
    db: Session,
    *,
    filename: str,
    source_path: Path,
    source_hash: str,
    size_bytes: int,
    payload: PhotoUploadRequest,
) -> PhotoRow:
    settings = get_settings()
    validate_upload_size(size_bytes=size_bytes, max_bytes=settings.photos_max_upload_bytes)

    file_extension = filename.rsplit(".", maxsplit=1)[-1].lower() if "." in filename else ""
    if file_extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValidationAppError("Unsupported image format")

    caption = collapse_whitespace(payload.caption)
    normalized_alt_text = collapse_whitespace(payload.alt_text) if payload.alt_text is not None else ""
    alt_text = normalized_alt_text or caption
    if not alt_text:
        raise ValidationAppError("alt_text or caption must be provided")

    processed = _process_uploaded_image(source_path=source_path, source_hash=source_hash)

    record = Photo(
        alt_text=alt_text,
        caption=caption,
        thumb_url=processed.thumb_url,
        full_url=processed.full_url,
        captured_at=_resolve_captured_at(
            source_path=source_path,
            override=payload.captured_at,
            client_last_modified=payload.client_last_modified,
        ),
        is_published=payload.is_published,
    )

    db.add(record)
    try:
        db.commit()
    except Exception:
        db.rollback()
        for written_path in processed.written_paths:
            _safe_unlink(written_path)
        raise

    db.refresh(record)
    return _to_photo_row(record)


def update_photo(db: Session, photo_id: UUID, payload: PhotoUpdateRequest) -> PhotoRow:
    record = db.query(Photo).filter(Photo.id == photo_id).one_or_none()
    if record is None:
        raise NotFoundAppError("Photo not found")

    if payload.alt_text is not None:
        record.alt_text = collapse_whitespace(payload.alt_text)
    if payload.caption is not None:
        record.caption = collapse_whitespace(payload.caption)
    if payload.thumb_url is not None:
        record.thumb_url = collapse_whitespace(payload.thumb_url)
    if payload.full_url is not None:
        record.full_url = collapse_whitespace(payload.full_url)
    if payload.captured_at is not None:
        record.captured_at = payload.captured_at
    if payload.is_published is not None:
        record.is_published = payload.is_published
    record.updated_at = func.now()

    db.commit()
    db.refresh(record)
    return _to_photo_row(record)


def delete_photo(db: Session, photo_id: UUID) -> None:
    record = db.query(Photo).filter(Photo.id == photo_id).with_for_update().one_or_none()
    if record is None:
        raise NotFoundAppError("Photo not found")

    media_urls = {record.thumb_url, record.full_url}

    if media_urls:
        db.query(Photo.id).filter(or_(Photo.thumb_url.in_(media_urls), Photo.full_url.in_(media_urls))).order_by(
            Photo.id.asc()
        ).with_for_update().all()

    db.delete(record)
    db.flush()

    cleanup_candidates = {
        media_url
        for media_url in media_urls
        if not _is_media_url_referenced_elsewhere(db=db, photo_id=photo_id, media_url=media_url)
    }
    db.commit()

    for media_url in cleanup_candidates:
        _delete_media_file_for_url(media_url)


def _resolve_captured_at(*, source_path: Path, override: datetime | None, client_last_modified: datetime | None) -> datetime:
    if override is not None:
        return _normalize_datetime(override)

    extracted = _extract_exif_captured_at(source_path)
    if extracted is not None:
        return extracted

    if client_last_modified is not None:
        return _normalize_datetime(client_last_modified)

    return datetime.now(timezone.utc)


def _extract_exif_captured_at(source_path: Path) -> datetime | None:
    try:
        from PIL import Image, UnidentifiedImageError
    except Exception:
        return None

    try:
        import pillow_heif

        pillow_heif.register_heif_opener()
    except Exception:
        pass

    try:
        with Image.open(source_path) as image:
            exif_data = image.getexif()
    except (UnidentifiedImageError, OSError):
        return None

    if not exif_data:
        return None

    for date_tag, offset_tag in (
        (EXIF_TAG_DATETIME_ORIGINAL, EXIF_TAG_OFFSET_TIME_ORIGINAL),
        (EXIF_TAG_CREATE_DATE, EXIF_TAG_OFFSET_TIME_DIGITIZED),
        (EXIF_TAG_DATETIME, EXIF_TAG_OFFSET_TIME),
    ):
        value = _coerce_exif_value(exif_data.get(date_tag))
        if not value:
            continue

        parsed = _parse_exif_datetime(value=value, offset_value=_coerce_exif_value(exif_data.get(offset_tag)))
        if parsed is not None:
            return parsed

    return None


def _parse_exif_datetime(*, value: str, offset_value: str | None = None) -> datetime | None:
    candidate = value.strip()
    if not candidate:
        return None

    embedded_offset, datetime_part = _split_embedded_exif_offset(candidate)
    timezone_offset = embedded_offset or offset_value

    formats = ("%Y:%m:%d %H:%M:%S", "%Y:%m:%d %H:%M:%S.%f")
    for candidate_format in formats:
        try:
            naive = datetime.strptime(datetime_part, candidate_format)
            tzinfo = _parse_timezone_offset(timezone_offset) or timezone.utc
            return naive.replace(tzinfo=tzinfo).astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _split_embedded_exif_offset(value: str) -> tuple[str | None, str]:
    if value.endswith("Z"):
        return "Z", value[:-1].strip()

    match = re.search(r"([+-]\d{2}:?\d{2})$", value)
    if match is None:
        return None, value

    return match.group(1), value[: match.start()].strip()


def _parse_timezone_offset(offset: str | None):
    if offset is None:
        return None

    normalized = offset.strip()
    if not normalized:
        return None

    if normalized == "Z":
        return timezone.utc

    if re.fullmatch(r"[+-]\d{2}:\d{2}", normalized):
        parsed = datetime.strptime(normalized, "%z")
        return parsed.tzinfo

    if re.fullmatch(r"[+-]\d{4}", normalized):
        parsed = datetime.strptime(normalized, "%z")
        return parsed.tzinfo

    if re.fullmatch(r"[+-]\d{2}", normalized):
        parsed = datetime.strptime(normalized + "00", "%z")
        return parsed.tzinfo

    return None


def _coerce_exif_value(value) -> str:
    if value is None:
        return ""

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore").strip()

    return str(value).strip()


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _process_uploaded_image(*, source_path: Path, source_hash: str) -> ProcessedPhotoMedia:
    settings = get_settings()
    subdir = collapse_whitespace(settings.photos_media_subdir).strip("/")
    output_dir = Path(settings.media_root_path) / subdir
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
        from PIL.Image import DecompressionBombError
    except Exception as exc:
        raise ValidationAppError("Image processing dependencies are not available") from exc

    try:
        import pillow_heif

        pillow_heif.register_heif_opener()
    except Exception:
        pass

    try:
        with Image.open(source_path) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.width * image.height > settings.photos_max_image_pixels:
                raise ValidationAppError("Image dimensions are too large")
            source = image.convert("RGB")
    except (UnidentifiedImageError, DecompressionBombError, OSError) as exc:
        raise ValidationAppError("Failed to decode image") from exc

    resample = Image.Resampling.LANCZOS
    thumb_image = _resize_with_target_width(source, settings.photos_thumb_width, resample)
    full_image = source.copy()

    thumb_name = f"{source_hash}-thumb.webp"
    full_name = f"{source_hash}-full.webp"
    thumb_path = output_dir / thumb_name
    full_path = output_dir / full_name

    written_paths: list[Path] = []

    if _save_webp_atomic_if_missing(thumb_image, destination=thumb_path, quality=settings.photos_thumb_webp_quality):
        written_paths.append(thumb_path)
    if _save_webp_atomic_if_missing(full_image, destination=full_path, quality=settings.photos_full_webp_quality):
        written_paths.append(full_path)

    return ProcessedPhotoMedia(
        thumb_url=f"/media/{subdir}/{thumb_name}",
        full_url=f"/media/{subdir}/{full_name}",
        written_paths=tuple(written_paths),
    )


def _save_webp_atomic_if_missing(image, *, destination: Path, quality: int) -> bool:
    if destination.exists():
        return False

    tmp_path = destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")
    try:
        image.save(tmp_path, format="WEBP", quality=quality, method=6)
        tmp_path.replace(destination)
        return True
    finally:
        if tmp_path.exists():
            _safe_unlink(tmp_path)


def _is_media_url_referenced_elsewhere(*, db: Session, photo_id: UUID, media_url: str) -> bool:
    if not media_url:
        return False

    count = (
        db.query(Photo)
        .filter(Photo.id != photo_id)
        .filter(or_(Photo.thumb_url == media_url, Photo.full_url == media_url))
        .count()
    )
    return count > 0


def _delete_media_file_for_url(media_url: str) -> None:
    path = _resolve_media_path_from_url(media_url)
    if path is None:
        return

    try:
        path.unlink()
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.warning("Failed to delete media file for url %s at path %s: %s", media_url, path, exc)
        return


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.warning("Failed to unlink path %s: %s", path, exc)
        return


def _resolve_media_path_from_url(media_url: str) -> Path | None:
    settings = get_settings()
    subdir = collapse_whitespace(settings.photos_media_subdir).strip("/")
    prefix = f"/media/{subdir}/"
    if not media_url.startswith(prefix):
        return None

    filename = media_url[len(prefix) :]
    if not filename or "/" in filename or "\\" in filename:
        return None

    root = (Path(settings.media_root_path) / subdir).resolve()
    candidate = (root / filename).resolve()
    if root not in candidate.parents:
        return None

    return candidate


def upload_size_limit_error(max_bytes: int) -> str:
    return f"Uploaded image exceeds configured max size ({max_bytes} bytes)"


def validate_upload_size(*, size_bytes: int, max_bytes: int) -> None:
    if size_bytes > max_bytes:
        raise ValidationAppError(upload_size_limit_error(max_bytes))


def _resize_with_target_width(image, target_width: int, resample):
    if image.width <= target_width:
        return image.copy()
    ratio = target_width / image.width
    target_height = max(int(image.height * ratio), 1)
    return image.resize((target_width, target_height), resample=resample)


def _to_photo_row(record: Photo) -> PhotoRow:
    return PhotoRow(
        id=record.id,
        alt_text=record.alt_text,
        caption=record.caption,
        thumb_url=record.thumb_url,
        full_url=record.full_url,
        captured_at=record.captured_at,
        is_published=record.is_published,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )
