import hashlib
import os
from pathlib import Path
import tempfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from api.dependencies.auth import require_admin_mutation, require_admin_session
from core.errors import UnauthorizedAppError, ValidationAppError
from core.settings import get_settings
from database import get_db
from models import AdminSession
from schemas import PhotoListQuery, PhotoListResponse, PhotoRow, PhotoUpdateRequest, PhotoUploadRequest
from services.photos import delete_photo, list_photos, update_photo, upload_photo, validate_upload_size


router = APIRouter(prefix="/v1/photos", tags=["photos"])


@router.get("", response_model=PhotoListResponse)
def list_photos_route(
    query: PhotoListQuery = Depends(),
    admin_session: AdminSession | None = Depends(require_admin_session),
    db: Session = Depends(get_db),
) -> PhotoListResponse:
    if query.include_unpublished:
        if admin_session is None:
            raise UnauthorizedAppError("Missing or invalid admin session")

    return list_photos(db=db, limit=query.limit, offset=query.offset, include_unpublished=query.include_unpublished)


@router.post("", response_model=PhotoRow)
def upload_photo_route(
    file: UploadFile = File(...),
    caption: str = Form(...),
    alt_text: str | None = Form(default=None),
    captured_at: str | None = Form(default=None),
    client_last_modified: str | None = Form(default=None),
    is_published: bool = Form(default=True),
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> PhotoRow:
    settings = get_settings()
    upload_path, source_hash, size_bytes = _stream_upload_to_temp(file=file, max_bytes=settings.photos_max_upload_bytes)

    try:
        normalized_captured_at = captured_at.strip() if captured_at is not None else None
        normalized_client_last_modified = client_last_modified.strip() if client_last_modified is not None else None
        try:
            payload = PhotoUploadRequest(
                caption=caption,
                alt_text=alt_text,
                captured_at=normalized_captured_at or None,
                client_last_modified=normalized_client_last_modified or None,
                is_published=is_published,
            )
        except ValidationError as exc:
            raise ValidationAppError(str(exc)) from exc
        return upload_photo(
            db=db,
            filename=file.filename or "upload",
            source_path=upload_path,
            source_hash=source_hash,
            size_bytes=size_bytes,
            payload=payload,
        )
    finally:
        try:
            upload_path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


@router.post("/{photo_id}", response_model=PhotoRow)
@router.patch("/{photo_id}", response_model=PhotoRow)
def update_photo_route(
    photo_id: UUID,
    payload: PhotoUpdateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> PhotoRow:
    return update_photo(db=db, photo_id=photo_id, payload=payload)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo_route(
    photo_id: UUID,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> Response:
    delete_photo(db=db, photo_id=photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _stream_upload_to_temp(*, file: UploadFile, max_bytes: int) -> tuple[Path, str, int]:
    descriptor, raw_path = tempfile.mkstemp(prefix="photo-upload-", suffix=".bin")
    path = Path(raw_path)

    total = 0
    digest = hashlib.sha256()

    try:
        with os.fdopen(descriptor, "wb") as handle:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                validate_upload_size(size_bytes=total, max_bytes=max_bytes)
                digest.update(chunk)
                handle.write(chunk)
    except Exception:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass
        raise

    return path, digest.hexdigest(), total
