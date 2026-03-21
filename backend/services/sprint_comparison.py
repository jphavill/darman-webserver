from itertools import groupby

from sqlalchemy.orm import Session

from core.errors import ValidationAppError
from core.text import collapse_whitespace
from models import Person, SprintEntry
from schemas import (
    ComparisonMode,
    RunWindow,
    SprintComparisonPoint,
    SprintComparisonResponse,
    SprintComparisonSeries,
)


def list_sprint_comparison(
    db: Session,
    mode: ComparisonMode,
    person_ids: list[int],
    location: str | None,
    run_window: RunWindow,
) -> SprintComparisonResponse:
    unique_person_ids = list(dict.fromkeys(person_ids))
    if not unique_person_ids:
        raise ValidationAppError("at least one person_id is required")
    if len(unique_person_ids) > 4:
        raise ValidationAppError("compare up to 4 people at once")

    people = (
        db.query(Person)
        .filter(Person.id.in_(unique_person_ids), Person.is_active.is_(True))
        .order_by(Person.id.asc())
        .all()
    )
    if len(people) != len(unique_person_ids):
        raise ValidationAppError("one or more person_ids are invalid")

    person_name_by_id = {person.id: person.name for person in people}
    sorted_people = sorted(unique_person_ids, key=lambda person_id: person_name_by_id[person_id].casefold())
    normalized_location = _normalize_optional_text(location)

    series = [
        _build_progression_series(
            db=db,
            person_id=person_id,
            person_name=person_name_by_id[person_id],
            normalized_location=normalized_location,
            run_window=run_window,
        )
        if mode == "progression"
        else _build_daily_best_series(
            db=db,
            person_id=person_id,
            person_name=person_name_by_id[person_id],
            normalized_location=normalized_location,
        )
        for person_id in sorted_people
    ]

    return SprintComparisonResponse(
        mode=mode,
        location=normalized_location,
        run_window=run_window,
        series=series,
    )


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = collapse_whitespace(value)
    return normalized or None


def _build_progression_series(
    db: Session,
    person_id: int,
    person_name: str,
    normalized_location: str | None,
    run_window: RunWindow,
) -> SprintComparisonSeries:
    query = (
        db.query(SprintEntry)
        .filter(SprintEntry.person_id == person_id)
        .order_by(
            SprintEntry.sprint_date.asc(),
            SprintEntry.created_at.asc(),
            SprintEntry.id.asc(),
        )
    )
    if normalized_location:
        query = query.filter(SprintEntry.location == normalized_location)

    entries = query.all()
    if run_window != "all":
        entries = entries[-int(run_window) :]

    points = [
        SprintComparisonPoint(x=index + 1, y=entry.sprint_time_ms, label=f"Attempt {index + 1}")
        for index, entry in enumerate(entries)
    ]
    return SprintComparisonSeries(person_id=person_id, person_name=person_name, points=points)


def _build_daily_best_series(
    db: Session,
    person_id: int,
    person_name: str,
    normalized_location: str | None,
) -> SprintComparisonSeries:
    query = (
        db.query(SprintEntry.sprint_date, SprintEntry.sprint_time_ms)
        .filter(SprintEntry.person_id == person_id)
        .order_by(SprintEntry.sprint_date.asc(), SprintEntry.sprint_time_ms.asc(), SprintEntry.id.asc())
    )
    if normalized_location:
        query = query.filter(SprintEntry.location == normalized_location)

    records = query.all()
    grouped_by_date = groupby(records, key=lambda record: record.sprint_date)
    points = [
        SprintComparisonPoint(
            x=str(sprint_date),
            y=min(record.sprint_time_ms for record in group_records),
            label=str(sprint_date),
        )
        for sprint_date, group_records in grouped_by_date
    ]
    return SprintComparisonSeries(person_id=person_id, person_name=person_name, points=points)
