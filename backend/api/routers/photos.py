from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies.auth import require_write_token
from database import get_db
from schemas import PhotoBatchUpsertRequest, PhotoListResponse
from services.photos import batch_upsert_photos, list_photos


router = APIRouter(prefix="/v1/photos", tags=["photos"])


@router.get("", response_model=PhotoListResponse)
def list_photos_route(
    limit: int = Query(default=60, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PhotoListResponse:
    return list_photos(db=db, limit=limit, offset=offset)


@router.post("/batch-upsert", response_model=PhotoListResponse)
def batch_upsert_photos_route(
    payload: PhotoBatchUpsertRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> PhotoListResponse:
    return batch_upsert_photos(db=db, payload=payload)
