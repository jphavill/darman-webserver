from uuid import UUID

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from core.errors import NotFoundAppError
from core.text import collapse_whitespace
from models import Photo
from schemas import PhotoBatchUpsertRequest, PhotoListResponse, PhotoRow, PhotoUpdateRequest


def list_photos(db: Session, limit: int, offset: int) -> PhotoListResponse:
    query = db.query(Photo).filter(Photo.is_published.is_(True))
    query = query.order_by(Photo.captured_at.desc(), Photo.created_at.desc(), Photo.id.asc())

    total = query.count()
    records = query.offset(offset).limit(limit).all()

    rows = [_to_photo_row(record) for record in records]

    return PhotoListResponse(rows=rows, total=total)


def batch_upsert_photos(db: Session, payload: PhotoBatchUpsertRequest) -> PhotoListResponse:
    rows = [
        {
            "id": item.id,
            "alt_text": collapse_whitespace(item.alt_text),
            "caption": collapse_whitespace(item.caption),
            "thumb_url": collapse_whitespace(item.thumb_url),
            "full_url": collapse_whitespace(item.full_url),
            "captured_at": item.captured_at,
            "is_published": item.is_published,
        }
        for item in payload.rows
    ]

    statement = insert(Photo).values(rows)
    statement = statement.on_conflict_do_update(
        index_elements=[Photo.id],
        set_={
            "alt_text": statement.excluded.alt_text,
            "caption": statement.excluded.caption,
            "thumb_url": statement.excluded.thumb_url,
            "full_url": statement.excluded.full_url,
            "captured_at": statement.excluded.captured_at,
            "is_published": statement.excluded.is_published,
            "updated_at": func.now(),
        },
    )
    db.execute(statement)

    db.commit()

    return list_photos(db=db, limit=200, offset=0)


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
    record = db.query(Photo).filter(Photo.id == photo_id).one_or_none()
    if record is None:
        raise NotFoundAppError("Photo not found")

    db.delete(record)
    db.commit()


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
