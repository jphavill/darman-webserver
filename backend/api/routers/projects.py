from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_admin_mutation, require_admin_session
from core.errors import UnauthorizedAppError, ValidationAppError
from core.settings import get_settings
from database import get_db
from models import AdminSession
from schemas import (
    ProjectCreateRequest,
    ProjectImageReorderRequest,
    ProjectImageRow,
    ProjectImageUpdateRequest,
    ProjectImageUploadRequest,
    ProjectListQuery,
    ProjectListResponse,
    ProjectReorderRequest,
    ProjectRow,
    ProjectUpdateRequest,
)
from services.projects import (
    create_project,
    delete_project_image,
    list_projects,
    reorder_project_images,
    reorder_projects,
    update_project,
    update_project_image,
    upload_project_image,
)


router = APIRouter(prefix="/v1/projects", tags=["projects"])


@router.get("", response_model=ProjectListResponse)
def list_projects_route(
    query: ProjectListQuery = Depends(),
    admin_session: AdminSession | None = Depends(require_admin_session),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    if query.include_unpublished and admin_session is None:
        raise UnauthorizedAppError("Missing or invalid admin session")

    return list_projects(db=db, project_type=query.type, include_unpublished=query.include_unpublished)


@router.post("", response_model=ProjectRow)
def create_project_route(
    payload: ProjectCreateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> ProjectRow:
    return create_project(db=db, payload=payload)


@router.patch("/{project_id}", response_model=ProjectRow)
def update_project_route(
    project_id: UUID,
    payload: ProjectUpdateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> ProjectRow:
    return update_project(db=db, project_id=project_id, payload=payload)


@router.post("/reorder", response_model=ProjectListResponse)
def reorder_projects_route(
    payload: ProjectReorderRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    return reorder_projects(db=db, project_type=payload.type, project_ids=payload.project_ids)


@router.post("/{project_id}/images", response_model=ProjectImageRow)
def upload_project_image_route(
    project_id: UUID,
    file: UploadFile = File(...),
    alt_text: str = Form(...),
    caption: str | None = Form(default=None),
    is_hero: bool = Form(default=False),
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> ProjectImageRow:
    settings = get_settings()
    payload = ProjectImageUploadRequest(alt_text=alt_text, caption=caption, is_hero=is_hero)
    content = _read_upload_content(file=file, max_bytes=settings.projects_max_upload_bytes)
    return upload_project_image(
        db=db,
        project_id=project_id,
        filename=file.filename or "upload",
        content=content,
        payload=payload,
    )


@router.patch("/{project_id}/images/reorder", response_model=list[ProjectImageRow])
def reorder_project_images_route(
    project_id: UUID,
    payload: ProjectImageReorderRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> list[ProjectImageRow]:
    return reorder_project_images(db=db, project_id=project_id, payload=payload)


@router.patch("/{project_id}/images/{image_id}", response_model=ProjectImageRow)
def update_project_image_route(
    project_id: UUID,
    image_id: UUID,
    payload: ProjectImageUpdateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> ProjectImageRow:
    return update_project_image(db=db, project_id=project_id, image_id=image_id, payload=payload)


@router.delete("/{project_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_image_route(
    project_id: UUID,
    image_id: UUID,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> Response:
    delete_project_image(db=db, project_id=project_id, image_id=image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _read_upload_content(*, file: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = file.file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise ValidationAppError(_upload_size_limit_error(max_bytes))
        chunks.append(chunk)

    return b"".join(chunks)


def _upload_size_limit_error(max_bytes: int) -> str:
    return f"Uploaded image exceeds configured max size ({max_bytes} bytes)"
