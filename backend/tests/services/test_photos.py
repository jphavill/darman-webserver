from uuid import uuid4

from schemas import PhotoBatchUpsertRequest, PhotoUpsertItem
from services.photos import batch_upsert_photos, list_photos


def test_batch_upsert_creates_and_updates_photo(db_session):
    photo_id = uuid4()

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
                    sort_order=20,
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
                    sort_order=5,
                    is_published=True,
                )
            ]
        ),
    )

    assert second.total == 1
    assert second.rows[0].caption == "Updated caption"
    assert second.rows[0].sort_order == 5


def test_list_photos_only_returns_published_sorted(db_session):
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
                    sort_order=20,
                    is_published=True,
                ),
                PhotoUpsertItem(
                    id=uuid4(),
                    alt_text="First",
                    caption="Visible first",
                    thumb_url="/media/gallery/first-thumb.webp",
                    full_url="/media/gallery/first-full.webp",
                    sort_order=10,
                    is_published=True,
                ),
                PhotoUpsertItem(
                    id=uuid4(),
                    alt_text="Hidden",
                    caption="Not visible",
                    thumb_url="/media/gallery/hidden-thumb.webp",
                    full_url="/media/gallery/hidden-full.webp",
                    sort_order=0,
                    is_published=False,
                ),
            ]
        ),
    )

    listed = list_photos(db=db_session, limit=10, offset=0)

    assert listed.total == 2
    assert listed.rows[0].caption == "Visible first"
    assert listed.rows[1].caption == "Visible second"
