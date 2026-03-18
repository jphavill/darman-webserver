from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from schemas import PhotoBatchUpsertRequest, PhotoUpdateRequest, PhotoUpsertItem
from services.photos import batch_upsert_photos, delete_photo, list_photos, update_photo


def test_batch_upsert_creates_and_updates_photo(db_session):
    photo_id = uuid4()
    old_capture = datetime.now(timezone.utc) - timedelta(days=2)
    new_capture = datetime.now(timezone.utc) - timedelta(days=1)

    first = batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=photo_id,
                    alt_text="Workshop bench",
                    caption="First caption",
                    thumb_url="/media/gallery/workshop-thumb.webp",
                    full_url="/media/gallery/workshop-full.webp",
                    captured_at=old_capture,
                    is_published=True,
                )
            ]
        ),
    )

    assert first.total == 1
    assert first.rows[0].caption == "First caption"

    second = batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=photo_id,
                    alt_text="Workshop bench",
                    caption="Updated caption",
                    thumb_url="/media/gallery/workshop-thumb-v2.webp",
                    full_url="/media/gallery/workshop-full-v2.webp",
                    captured_at=new_capture,
                    is_published=True,
                )
            ]
        ),
    )

    assert second.total == 1
    assert second.rows[0].caption == "Updated caption"
    assert second.rows[0].captured_at == new_capture


def test_list_photos_only_returns_published_sorted(db_session):
    now = datetime.now(timezone.utc)
    batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=uuid4(),
                    alt_text="Second",
                    caption="Visible second",
                    thumb_url="/media/gallery/second-thumb.webp",
                    full_url="/media/gallery/second-full.webp",
                    captured_at=now - timedelta(days=2),
                    is_published=True,
                ),
                PhotoUpsertItem(
                    id=uuid4(),
                    alt_text="First",
                    caption="Visible first",
                    thumb_url="/media/gallery/first-thumb.webp",
                    full_url="/media/gallery/first-full.webp",
                    captured_at=now - timedelta(days=1),
                    is_published=True,
                ),
                PhotoUpsertItem(
                    id=uuid4(),
                    alt_text="Hidden",
                    caption="Not visible",
                    thumb_url="/media/gallery/hidden-thumb.webp",
                    full_url="/media/gallery/hidden-full.webp",
                    captured_at=now,
                    is_published=False,
                ),
            ]
        ),
    )

    listed = list_photos(db=db_session, limit=10, offset=0)

    assert listed.total == 2
    assert listed.rows[0].caption == "Visible first"
    assert listed.rows[1].caption == "Visible second"


def test_update_photo_updates_existing_record(db_session):
    photo_id = uuid4()
    original_capture = datetime.now(timezone.utc) - timedelta(days=3)
    updated_capture = datetime.now(timezone.utc)

    batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=photo_id,
                    alt_text="Old alt",
                    caption="Old caption",
                    thumb_url="/media/gallery/old-thumb.webp",
                    full_url="/media/gallery/old-full.webp",
                    captured_at=original_capture,
                    is_published=True,
                )
            ]
        ),
    )

    updated = update_photo(
        db=db_session,
        photo_id=photo_id,
        payload=PhotoUpdateRequest(
            alt_text="New alt",
            caption="New caption",
            thumb_url="/media/gallery/new-thumb.webp",
            full_url="/media/gallery/new-full.webp",
            captured_at=updated_capture,
            is_published=False,
        ),
    )

    assert updated.id == photo_id
    assert updated.alt_text == "New alt"
    assert updated.caption == "New caption"
    assert updated.thumb_url == "/media/gallery/new-thumb.webp"
    assert updated.full_url == "/media/gallery/new-full.webp"
    assert updated.captured_at == updated_capture
    assert updated.is_published is False


def test_update_photo_supports_partial_updates(db_session):
    photo_id = uuid4()
    captured_at = datetime.now(timezone.utc) - timedelta(days=3)

    batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=photo_id,
                    alt_text="Original alt",
                    caption="Original caption",
                    thumb_url="/media/gallery/original-thumb.webp",
                    full_url="/media/gallery/original-full.webp",
                    captured_at=captured_at,
                    is_published=True,
                )
            ]
        ),
    )

    updated = update_photo(
        db=db_session,
        photo_id=photo_id,
        payload=PhotoUpdateRequest(caption="Updated caption only", is_published=False),
    )

    assert updated.id == photo_id
    assert updated.alt_text == "Original alt"
    assert updated.caption == "Updated caption only"
    assert updated.thumb_url == "/media/gallery/original-thumb.webp"
    assert updated.full_url == "/media/gallery/original-full.webp"
    assert updated.captured_at == captured_at
    assert updated.is_published is False


def test_delete_photo_removes_record(db_session):
    photo_id = uuid4()

    batch_upsert_photos(
        db=db_session,
        payload=PhotoBatchUpsertRequest(
            rows=[
                PhotoUpsertItem(
                    id=photo_id,
                    alt_text="Delete me",
                    caption="Will be deleted",
                    thumb_url="/media/gallery/delete-thumb.webp",
                    full_url="/media/gallery/delete-full.webp",
                    captured_at=datetime.now(timezone.utc),
                    is_published=True,
                )
            ]
        ),
    )

    delete_photo(db=db_session, photo_id=photo_id)
    listed = list_photos(db=db_session, limit=10, offset=0)
    assert listed.total == 0


def test_update_and_delete_photo_raise_404_for_missing_id(db_session):
    missing_id = uuid4()

    with pytest.raises(HTTPException) as update_exc:
        update_photo(
            db=db_session,
            photo_id=missing_id,
            payload=PhotoUpdateRequest(
                alt_text="Missing",
                caption="Missing",
                thumb_url="/media/gallery/missing-thumb.webp",
                full_url="/media/gallery/missing-full.webp",
                captured_at=datetime.now(timezone.utc),
                is_published=True,
            ),
        )

    with pytest.raises(HTTPException) as delete_exc:
        delete_photo(db=db_session, photo_id=missing_id)

    assert update_exc.value.status_code == 404
    assert delete_exc.value.status_code == 404
