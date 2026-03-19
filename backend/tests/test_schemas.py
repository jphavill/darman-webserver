from datetime import date, datetime

from uuid import uuid4

import pytest
from pydantic import ValidationError

from schemas import PhotoBatchUpsertRequest, SprintCreateRequest, SprintListResponse, SprintRow


def test_sprint_create_request_accepts_valid_payload():
    payload = SprintCreateRequest(
        name="Sam",
        sprint_time_ms=9988,
        sprint_date=date(2026, 3, 10),
        location="Central Park",
    )
    assert payload.name == "Sam"
    assert payload.sprint_time_ms == 9988


def test_sprint_create_request_rejects_invalid_time():
    with pytest.raises(ValidationError):
        SprintCreateRequest(name="Sam", sprint_time_ms=0, sprint_date=date(2026, 3, 10), location="Anywhere")


def test_sprint_create_request_requires_person_id_or_name():
    with pytest.raises(ValidationError):
        SprintCreateRequest(sprint_time_ms=9988, sprint_date=date(2026, 3, 10), location="Anywhere")


def test_sprint_create_request_rejects_blank_name_after_normalization():
    with pytest.raises(ValidationError):
        SprintCreateRequest(name="   ", sprint_time_ms=9988, sprint_date=date(2026, 3, 10), location="Anywhere")


def test_sprint_list_response_shape():
    row = SprintRow(
        id=1,
        name="Casey",
        sprint_time_ms=10111,
        sprint_date=date(2026, 3, 11),
        location="Track C",
        created_at=datetime.now(),
    )
    response = SprintListResponse(rows=[row], total=1)
    assert response.total == 1
    assert response.rows[0].name == "Casey"


def test_photo_batch_upsert_request_requires_rows():
    with pytest.raises(ValidationError):
        PhotoBatchUpsertRequest(rows=[])


def test_photo_batch_upsert_request_accepts_valid_payload():
    payload = PhotoBatchUpsertRequest(
        rows=[
            {
                "id": str(uuid4()),
                "alt_text": "Bridge at dusk",
                "caption": "Blue hour",
                "thumb_url": "/media/gallery/bridge-thumb.webp",
                "full_url": "/media/gallery/bridge-full.webp",
                "captured_at": datetime.now().astimezone().isoformat(),
                "is_published": True,
            }
        ]
    )

    assert len(payload.rows) == 1
