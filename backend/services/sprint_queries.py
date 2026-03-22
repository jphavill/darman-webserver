from datetime import date
from typing import Any

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Query, Session

from core.text import collapse_whitespace
from models import Person, SprintEntry
from schemas import TextFilterType
from schemas import BestTimeRow, BestTimesResponse, SprintListResponse, SprintRow


def list_sprints(
    db: Session,
    limit: int,
    offset: int,
    sort_by: str,
    sort_dir: str,
    name: str | None,
    name_filter_type: TextFilterType,
    location: str | None,
    location_filter_type: TextFilterType,
    date_from: date | None,
    date_to: date | None,
    min_time_ms: int | None,
    max_time_ms: int | None,
    date_not: date | None = None,
) -> SprintListResponse:
    query = db.query(SprintEntry, Person.name.label("name")).join(Person, SprintEntry.person_id == Person.id)
    query = _apply_common_person_entry_filters(
        query=query,
        name=name,
        name_filter_type=name_filter_type,
        location=location,
        location_filter_type=location_filter_type,
        date_from=date_from,
        date_to=date_to,
        date_not=date_not,
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
    name_filter_type: TextFilterType,
    location: str | None,
    location_filter_type: TextFilterType,
    date_from: date | None,
    date_to: date | None,
    date_not: date | None = None,
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
        name_filter_type=name_filter_type,
        location=location,
        location_filter_type=location_filter_type,
        date_from=date_from,
        date_to=date_to,
        date_not=date_not,
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
    name_filter_type: TextFilterType,
    location: str | None,
    location_filter_type: TextFilterType,
    date_from: date | None,
    date_to: date | None,
    date_not: date | None,
    location_column: Any,
    sprint_date_column: Any,
) -> Query:
    filters: list[Any] = []
    name_filter = _build_text_filter(Person.name, name, name_filter_type)
    if name_filter is not None:
        filters.append(name_filter)

    location_filter = _build_text_filter(location_column, location, location_filter_type)
    if location_filter is not None:
        filters.append(location_filter)

    if date_from:
        filters.append(sprint_date_column >= date_from)
    if date_to:
        filters.append(sprint_date_column <= date_to)
    if date_not:
        filters.append(sprint_date_column != date_not)

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


def _build_text_filter(column: Any, value: str | None, filter_type: TextFilterType) -> Any | None:
    blank_filter = or_(column.is_(None), func.length(func.btrim(column)) == 0)
    if filter_type == "blank":
        return blank_filter
    if filter_type == "notBlank":
        return and_(column.is_not(None), func.length(func.btrim(column)) > 0)

    normalized_value = _normalize_optional_text(value)
    if not normalized_value:
        return None

    if filter_type == "contains":
        return column.ilike(f"%{normalized_value}%")
    if filter_type == "notContains":
        return ~column.ilike(f"%{normalized_value}%")
    if filter_type == "equals":
        return func.lower(column) == normalized_value.lower()
    if filter_type == "notEqual":
        return func.lower(column) != normalized_value.lower()
    if filter_type == "startsWith":
        return column.ilike(f"{normalized_value}%")
    if filter_type == "endsWith":
        return column.ilike(f"%{normalized_value}")

    return None
