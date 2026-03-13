from datetime import date, datetime

import pytest
from pydantic import ValidationError

from schemas import SprintCreateRequest, SprintListResponse, SprintRow


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
