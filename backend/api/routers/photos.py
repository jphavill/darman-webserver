from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_write_token
from database import get_db
from schemas import PhotoBatchUpsertRequest, PhotoListQuery, PhotoListResponse, PhotoRow, PhotoUpdateRequest
from services.photos import batch_upsert_photos, delete_photo, list_photos, update_photo


router = APIRouter(prefix="/v1/photos", tags=["photos"])


@router.get("", response_model=PhotoListResponse)
def list_photos_route(
    query: PhotoListQuery = Depends(),
    db: Session = Depends(get_db),
) -> PhotoListResponse:
    return list_photos(db=db, limit=query.limit, offset=query.offset)


@router.post("/batch-upsert", response_model=PhotoListResponse)
def batch_upsert_photos_route(
    payload: PhotoBatchUpsertRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> PhotoListResponse:
    return batch_upsert_photos(db=db, payload=payload)


@router.post("/{photo_id}", response_model=PhotoRow)
@router.patch("/{photo_id}", response_model=PhotoRow)
def update_photo_route(
    photo_id: UUID,
    payload: PhotoUpdateRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> PhotoRow:
    return update_photo(db=db, photo_id=photo_id, payload=payload)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo_route(
    photo_id: UUID,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> Response:
    delete_photo(db=db, photo_id=photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
