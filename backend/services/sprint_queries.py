from datetime import date
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Query, Session

from core.text import collapse_whitespace
from models import Person, SprintEntry
from schemas import BestTimeRow, BestTimesResponse, SprintListResponse, SprintRow


def list_sprints(
    db: Session,
    limit: int,
    offset: int,
    sort_by: str,
    sort_dir: str,
    name: str | None,
    location: str | None,
    date_from: date | None,
    date_to: date | None,
    min_time_ms: int | None,
    max_time_ms: int | None,
) -> SprintListResponse:
    query = db.query(SprintEntry, Person.name.label("name")).join(Person, SprintEntry.person_id == Person.id)
    query = _apply_common_person_entry_filters(
        query=query,
        name=name,
        location=location,
        date_from=date_from,
        date_to=date_to,
        location_column=SprintEntry.location,
        sprint_date_column=SprintEntry.sprint_date,
    )
    query = _apply_time_range_filter(query=query, min_time_ms=min_time_ms, max_time_ms=max_time_ms)

    sort_columns = {
        "name": Person.name,
        "sprint_time_ms": SprintEntry.sprint_time_ms,
        "sprint_date": SprintEntry.sprint_date,
        "location": SprintEntry.location,
        "created_at": SprintEntry.created_at,
    }
    query = _apply_ordering(
        query=query,
        sort_column=sort_columns[sort_by],
        sort_dir=sort_dir,
        tie_breaker=SprintEntry.id.desc(),
    )

    total = query.count()
    records = query.offset(offset).limit(limit).all()

    rows = [
        SprintRow(
            id=entry.id,
            name=person_name,
            sprint_time_ms=entry.sprint_time_ms,
            sprint_date=entry.sprint_date,
            location=entry.location,
            created_at=entry.created_at,
        )
        for entry, person_name in records
    ]

    return SprintListResponse(rows=rows, total=total)


def list_best_times(
    db: Session,
    limit: int,
    offset: int,
    sort_by: str,
    sort_dir: str,
    name: str | None,
    location: str | None,
    date_from: date | None,
    date_to: date | None,
) -> BestTimesResponse:
    ranked_entries = (
        db.query(
            SprintEntry.person_id.label("person_id"),
            SprintEntry.id.label("sprint_entry_id"),
            SprintEntry.sprint_time_ms.label("best_time_ms"),
            SprintEntry.sprint_date.label("sprint_date"),
            SprintEntry.location.label("location"),
            SprintEntry.created_at.label("updated_at"),
            func.row_number()
            .over(
                partition_by=SprintEntry.person_id,
                order_by=(
                    SprintEntry.sprint_time_ms.asc(),
                    SprintEntry.sprint_date.asc(),
                    SprintEntry.id.asc(),
                ),
            )
            .label("rank"),
        )
        .subquery()
    )

    query = db.query(
        ranked_entries.c.person_id,
        ranked_entries.c.sprint_entry_id,
        Person.name.label("name"),
        ranked_entries.c.best_time_ms,
        ranked_entries.c.sprint_date,
        ranked_entries.c.location,
        ranked_entries.c.updated_at,
    ).join(Person, Person.id == ranked_entries.c.person_id)
    query = query.filter(ranked_entries.c.rank == 1)
    query = _apply_common_person_entry_filters(
        query=query,
        name=name,
        location=location,
        date_from=date_from,
        date_to=date_to,
        location_column=ranked_entries.c.location,
        sprint_date_column=ranked_entries.c.sprint_date,
    )

    sort_columns = {
        "name": Person.name,
        "best_time_ms": ranked_entries.c.best_time_ms,
        "sprint_date": ranked_entries.c.sprint_date,
        "location": ranked_entries.c.location,
        "updated_at": ranked_entries.c.updated_at,
    }
    query = _apply_ordering(
        query=query,
        sort_column=sort_columns[sort_by],
        sort_dir=sort_dir,
        tie_breaker=Person.id.asc(),
    )

    total = query.count()
    records = query.offset(offset).limit(limit).all()

    rows = [
        BestTimeRow(
            person_id=record.person_id,
            sprint_entry_id=record.sprint_entry_id,
            name=record.name,
            best_time_ms=record.best_time_ms,
            sprint_date=record.sprint_date,
            location=record.location,
            updated_at=record.updated_at,
        )
        for record in records
    ]

    return BestTimesResponse(rows=rows, total=total)


def list_locations(db: Session) -> list[str]:
    records = db.query(SprintEntry.location).distinct().order_by(SprintEntry.location.asc()).all()
    return [record[0] for record in records]


def _apply_common_person_entry_filters(
    query: Query,
    name: str | None,
    location: str | None,
    date_from: date | None,
    date_to: date | None,
    location_column: Any,
    sprint_date_column: Any,
) -> Query:
    filters: list[Any] = []
    normalized_name = _normalize_optional_text(name)
    normalized_location = _normalize_optional_text(location)

    if normalized_name:
        filters.append(Person.name.ilike(f"%{normalized_name}%"))
    if normalized_location:
        filters.append(location_column.ilike(f"%{normalized_location}%"))
    if date_from:
        filters.append(sprint_date_column >= date_from)
    if date_to:
        filters.append(sprint_date_column <= date_to)

    if filters:
        return query.filter(and_(*filters))
    return query


def _apply_time_range_filter(
    query: Query,
    min_time_ms: int | None,
    max_time_ms: int | None,
) -> Query:
    filters: list[Any] = []
    if min_time_ms is not None:
        filters.append(SprintEntry.sprint_time_ms >= min_time_ms)
    if max_time_ms is not None:
        filters.append(SprintEntry.sprint_time_ms <= max_time_ms)

    if filters:
        return query.filter(and_(*filters))
    return query


def _apply_ordering(query: Query, sort_column: Any, sort_dir: str, tie_breaker: Any) -> Query:
    direction = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    return query.order_by(direction, tie_breaker)


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = collapse_whitespace(value)
    return normalized or None
