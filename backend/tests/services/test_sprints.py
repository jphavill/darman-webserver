from datetime import date

from schemas import SprintCreateRequest
from services.sprints import create_sprint_entry, list_best_times, list_sprints


def test_create_sprint_entry_upserts_best_time(db_session):
    first = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            name="Taylor",
            sprint_time_ms=10400,
            sprint_date=date(2026, 3, 1),
            location="Track A",
        ),
    )
    second = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            name="Taylor",
            sprint_time_ms=9800,
            sprint_date=date(2026, 3, 2),
            location="Track B",
        ),
    )

    assert first.name == second.name

    best = list_best_times(
        db=db_session,
        limit=10,
        offset=0,
        sort_by="best_time_ms",
        sort_dir="asc",
        name="Taylor",
        location=None,
        date_from=None,
        date_to=None,
    )
    assert best.total == 1
    assert best.rows[0].best_time_ms == 9800


def test_list_sprints_filters_and_orders(db_session):
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Avery", sprint_time_ms=10000, sprint_date=date(2026, 3, 1), location="North"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Avery", sprint_time_ms=9700, sprint_date=date(2026, 3, 2), location="North"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Jordan", sprint_time_ms=9900, sprint_date=date(2026, 3, 2), location="South"),
    )

    result = list_sprints(
        db=db_session,
        limit=5,
        offset=0,
        sort_by="sprint_time_ms",
        sort_dir="asc",
        name="Avery",
        location="North",
        date_from=None,
        date_to=None,
        min_time_ms=9600,
        max_time_ms=10000,
    )

    assert result.total == 2
    assert result.rows[0].sprint_time_ms == 9700
    assert result.rows[1].sprint_time_ms == 10000
