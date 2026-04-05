from datetime import date, datetime

import pytest
from pydantic import ValidationError

from schemas import (
    PhotoUploadRequest,
    ProjectCreateRequest,
    SprintCreateRequest,
    SprintListResponse,
    SprintRow,
)


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


def test_photo_upload_request_requires_caption():
    with pytest.raises(ValidationError):
        PhotoUploadRequest(caption="")


def test_photo_upload_request_allows_blank_alt_text():
    payload = PhotoUploadRequest(caption="Caption", alt_text="", client_last_modified="2026-03-20T02:16:45+00:00")
    assert payload.caption == "Caption"


def test_photo_upload_request_parses_capture_fields_as_datetimes():
    payload = PhotoUploadRequest(
        caption="Caption",
        captured_at="2026-04-05T17:30:00+00:00",
        client_last_modified="2026-03-20T02:16:45+00:00",
    )
    assert payload.captured_at is not None
    assert payload.client_last_modified is not None


def test_photo_upload_request_rejects_invalid_capture_datetime():
    with pytest.raises(ValidationError):
        PhotoUploadRequest(caption="Caption", captured_at="not-a-date")


def test_project_create_request_accepts_links():
    payload = ProjectCreateRequest(
        title="Demo",
        short_description="Short",
        long_description_md="Long",
        type="software",
        is_published=False,
        links=[{"type": "github", "label": "Repo", "url": "https://github.com/example/repo"}],
    )
    assert payload.links[0].type == "github"
