import hashlib
import io
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from core.errors import NotFoundAppError, ValidationAppError
from core.settings import get_settings
from core.text import collapse_whitespace
from models import Project, ProjectImage, ProjectLink
from schemas import (
    ProjectCreateRequest,
    ProjectImageReorderRequest,
    ProjectImageRow,
    ProjectImageUpdateRequest,
    ProjectImageUploadRequest,
    ProjectLinkInput,
    ProjectLinkRow,
    ProjectListResponse,
    ProjectRow,
    ProjectUpdateRequest,
)


ALLOWED_UPLOAD_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "heic"}
MAX_IMAGES_PER_PROJECT = 12


def list_projects(
    db: Session,
    *,
    project_type: str | None,
    include_unpublished: bool,
) -> ProjectListResponse:
    query = db.query(Project).options(
        selectinload(Project.images),
        selectinload(Project.links),
    )

    if project_type:
        query = query.filter(Project.type == project_type)

    if not include_unpublished:
        query = query.filter(Project.is_published.is_(True))

    query = query.order_by(Project.type.asc(), Project.sort_order.asc(), Project.created_at.asc())
    total = query.count()
    records = query.all()
    return ProjectListResponse(rows=[_to_project_row(record) for record in records], total=total)


def create_project(db: Session, payload: ProjectCreateRequest) -> ProjectRow:
    sort_order = (
        db.query(func.coalesce(func.max(Project.sort_order), -1))
        .filter(Project.type == payload.type)
        .scalar()
    )
    next_sort_order = int(sort_order) + 1

    record = Project(
        title=collapse_whitespace(payload.title),
        short_description=collapse_whitespace(payload.short_description),
        long_description_md=payload.long_description_md.strip(),
        type=payload.type,
        is_published=payload.is_published,
        sort_order=next_sort_order,
    )
    db.add(record)
    db.flush()

    _replace_project_links(db=db, project_id=record.id, links=payload.links)

    db.commit()
    db.refresh(record)
    return _fetch_project_row(db=db, project_id=record.id)


def update_project(db: Session, project_id: UUID, payload: ProjectUpdateRequest) -> ProjectRow:
    record = db.query(Project).filter(Project.id == project_id).one_or_none()
    if record is None:
        raise NotFoundAppError("Project not found")

    original_type = record.type

    if payload.title is not None:
        record.title = collapse_whitespace(payload.title)
    if payload.short_description is not None:
        record.short_description = collapse_whitespace(payload.short_description)
    if payload.long_description_md is not None:
        record.long_description_md = payload.long_description_md.strip()
    type_changed = payload.type is not None and payload.type != original_type

    if payload.type is not None:
        record.type = payload.type
    if payload.is_published is not None:
        record.is_published = payload.is_published

    if type_changed:
        sort_order = (
            db.query(func.coalesce(func.max(Project.sort_order), -1))
            .filter(Project.type == payload.type, Project.id != record.id)
            .scalar()
        )
        record.sort_order = int(sort_order) + 1

    if payload.links is not None:
        _replace_project_links(db=db, project_id=record.id, links=payload.links)

    record.updated_at = func.now()
    db.commit()
    db.refresh(record)
    return _fetch_project_row(db=db, project_id=record.id)


def reorder_projects(db: Session, project_type: str, project_ids: list[UUID]) -> ProjectListResponse:
    if len(set(project_ids)) != len(project_ids):
        raise ValidationAppError("project_ids must not contain duplicates")

    records = db.query(Project).filter(Project.type == project_type).all()
    record_by_id = {record.id: record for record in records}

    if set(project_ids) != set(record_by_id.keys()):
        raise ValidationAppError("project_ids must include each project in the section exactly once")

    for index, project_id in enumerate(project_ids):
        record_by_id[project_id].sort_order = index
        record_by_id[project_id].updated_at = func.now()

    db.commit()
    return list_projects(db=db, project_type=project_type, include_unpublished=True)


def upload_project_image(
    db: Session,
    *,
    project_id: UUID,
    filename: str,
    content: bytes,
    payload: ProjectImageUploadRequest,
) -> ProjectImageRow:
    settings = get_settings()
    project = db.query(Project).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise NotFoundAppError("Project not found")

    if len(content) > settings.projects_max_upload_bytes:
        raise ValidationAppError(_upload_size_limit_error(settings.projects_max_upload_bytes))

    existing_count = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).count()
    if existing_count >= MAX_IMAGES_PER_PROJECT:
        raise ValidationAppError(f"A project can have at most {MAX_IMAGES_PER_PROJECT} images")

    file_extension = filename.rsplit(".", maxsplit=1)[-1].lower() if "." in filename else ""
    if file_extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValidationAppError("Unsupported image format")

    processed = _process_uploaded_image(content=content)

    sort_order = (
        db.query(func.coalesce(func.max(ProjectImage.sort_order), -1))
        .filter(ProjectImage.project_id == project_id)
        .scalar()
    )

    if payload.is_hero:
        db.query(ProjectImage).filter(ProjectImage.project_id == project_id).update({"is_hero": False})

    record = ProjectImage(
        project_id=project_id,
        thumb_url=processed["thumb_url"],
        full_url=processed["full_url"],
        alt_text=collapse_whitespace(payload.alt_text),
        caption=collapse_whitespace(payload.caption) if payload.caption else None,
        sort_order=int(sort_order) + 1,
        is_hero=payload.is_hero,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_project_image_row(record)


def reorder_project_images(db: Session, project_id: UUID, payload: ProjectImageReorderRequest) -> list[ProjectImageRow]:
    project_exists = db.query(Project.id).filter(Project.id == project_id).one_or_none()
    if project_exists is None:
        raise NotFoundAppError("Project not found")

    records = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).all()
    if not records:
        raise ValidationAppError("Project has no images to reorder")

    record_by_id = {record.id: record for record in records}
    requested_ids = payload.image_ids

    if set(requested_ids) != set(record_by_id.keys()):
        raise ValidationAppError("image_ids must include each project image exactly once")

    for index, image_id in enumerate(requested_ids):
        record_by_id[image_id].sort_order = index
        record_by_id[image_id].updated_at = func.now()

    db.commit()
    refreshed = (
        db.query(ProjectImage)
        .filter(ProjectImage.project_id == project_id)
        .order_by(ProjectImage.sort_order.asc(), ProjectImage.created_at.asc())
        .all()
    )
    return [_to_project_image_row(record) for record in refreshed]


def update_project_image(db: Session, project_id: UUID, image_id: UUID, payload: ProjectImageUpdateRequest) -> ProjectImageRow:
    record = (
        db.query(ProjectImage)
        .filter(ProjectImage.project_id == project_id, ProjectImage.id == image_id)
        .one_or_none()
    )
    if record is None:
        raise NotFoundAppError("Project image not found")

    if payload.is_hero is not None:
        if payload.is_hero:
            db.query(ProjectImage).filter(ProjectImage.project_id == project_id).update({"is_hero": False})
            record.is_hero = True
        else:
            record.is_hero = False

    record.updated_at = func.now()
    db.commit()
    db.refresh(record)
    return _to_project_image_row(record)


def delete_project_image(db: Session, project_id: UUID, image_id: UUID) -> None:
    record = (
        db.query(ProjectImage)
        .filter(ProjectImage.project_id == project_id, ProjectImage.id == image_id)
        .one_or_none()
    )
    if record is None:
        raise NotFoundAppError("Project image not found")

    image_urls = {record.thumb_url, record.full_url}
    referenced_urls = {
        url
        for url in image_urls
        if _is_image_url_referenced_elsewhere(db=db, image_id=image_id, media_url=url)
    }

    db.delete(record)
    db.commit()

    for media_url in image_urls - referenced_urls:
        _delete_media_file_for_url(media_url)


def _fetch_project_row(db: Session, project_id: UUID) -> ProjectRow:
    record = (
        db.query(Project)
        .options(selectinload(Project.images), selectinload(Project.links))
        .filter(Project.id == project_id)
        .one_or_none()
    )
    if record is None:
        raise NotFoundAppError("Project not found")
    return _to_project_row(record)


def _replace_project_links(db: Session, project_id: UUID, links: list[ProjectLinkInput]) -> None:
    db.query(ProjectLink).filter(ProjectLink.project_id == project_id).delete()
    for index, link in enumerate(links):
        db.add(
            ProjectLink(
                project_id=project_id,
                type=link.type,
                label=collapse_whitespace(link.label),
                url=collapse_whitespace(link.url),
                sort_order=index,
            )
        )


def _process_uploaded_image(content: bytes) -> dict[str, str]:
    settings = get_settings()
    subdir = collapse_whitespace(settings.projects_media_subdir).strip("/")
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
        with Image.open(io.BytesIO(content)) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.width * image.height > settings.projects_max_image_pixels:
                raise ValidationAppError("Image dimensions are too large")
            source = image.convert("RGB")
    except (UnidentifiedImageError, DecompressionBombError, OSError) as exc:
        raise ValidationAppError("Failed to decode image") from exc

    resample = Image.Resampling.LANCZOS
    thumb_image = _resize_with_target_width(source, settings.projects_thumb_width, resample)
    full_image = _resize_with_max_width(source, settings.projects_full_max_width, resample)

    source_hash = hashlib.sha256(content).hexdigest()
    thumb_name = f"{source_hash}-thumb.webp"
    full_name = f"{source_hash}-full.webp"
    thumb_path = output_dir / thumb_name
    full_path = output_dir / full_name

    thumb_image.save(thumb_path, format="WEBP", quality=settings.projects_thumb_webp_quality, method=6)
    full_image.save(full_path, format="WEBP", quality=settings.projects_full_webp_quality, method=6)

    return {
        "thumb_url": f"/media/{subdir}/{thumb_name}",
        "full_url": f"/media/{subdir}/{full_name}",
    }


def _is_image_url_referenced_elsewhere(*, db: Session, image_id: UUID, media_url: str) -> bool:
    if not media_url:
        return False

    count = (
        db.query(ProjectImage)
        .filter(ProjectImage.id != image_id)
        .filter(or_(ProjectImage.thumb_url == media_url, ProjectImage.full_url == media_url))
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
    except OSError:
        return


def _resolve_media_path_from_url(media_url: str) -> Path | None:
    settings = get_settings()
    subdir = collapse_whitespace(settings.projects_media_subdir).strip("/")
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


def _upload_size_limit_error(max_bytes: int) -> str:
    return f"Uploaded image exceeds configured max size ({max_bytes} bytes)"


def _resize_with_target_width(image, target_width: int, resample):
    if image.width <= target_width:
        return image.copy()
    ratio = target_width / image.width
    target_height = max(int(image.height * ratio), 1)
    return image.resize((target_width, target_height), resample=resample)


def _resize_with_max_width(image, max_width: int, resample):
    if image.width <= max_width:
        return image.copy()
    ratio = max_width / image.width
    target_height = max(int(image.height * ratio), 1)
    return image.resize((max_width, target_height), resample=resample)


def _to_project_row(record: Project) -> ProjectRow:
    sorted_images = sorted(record.images, key=lambda image: (image.sort_order, image.created_at, image.id))
    sorted_links = sorted(record.links, key=lambda link: (link.sort_order, link.id))
    return ProjectRow(
        id=record.id,
        title=record.title,
        short_description=record.short_description,
        long_description_md=record.long_description_md,
        type=record.type,
        is_published=record.is_published,
        sort_order=record.sort_order,
        links=[_to_project_link_row(link) for link in sorted_links],
        images=[_to_project_image_row(image) for image in sorted_images],
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _to_project_image_row(record: ProjectImage) -> ProjectImageRow:
    return ProjectImageRow(
        id=record.id,
        thumb_url=record.thumb_url,
        full_url=record.full_url,
        alt_text=record.alt_text,
        caption=record.caption,
        sort_order=record.sort_order,
        is_hero=record.is_hero,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _to_project_link_row(record: ProjectLink) -> ProjectLinkRow:
    return ProjectLinkRow(
        id=record.id,
        type=record.type,
        label=record.label,
        url=record.url,
        sort_order=record.sort_order,
    )
