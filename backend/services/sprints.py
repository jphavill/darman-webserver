from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Query, Session

from models import Person, PersonBestTime, SprintEntry
from schemas import BestTimeRow, BestTimesResponse, SprintCreateRequest, SprintListResponse, SprintRow


def create_sprint_entry(db: Session, payload: SprintCreateRequest) -> SprintRow:
    clean_name = _normalize_text(payload.name)
    clean_location = _normalize_text(payload.location)

    if not clean_name:
        raise HTTPException(status_code=422, detail="name cannot be empty")
    if not clean_location:
        raise HTTPException(status_code=422, detail="location cannot be empty")

    person = (
        db.query(Person)
        .filter(func.lower(Person.name) == clean_name.lower())
        .one_or_none()
    )
    if person is None:
        person = Person(name=clean_name)
        db.add(person)
        db.flush()

    entry = SprintEntry(
        person_id=person.id,
        sprint_time_ms=payload.sprint_time_ms,
        sprint_date=payload.sprint_date,
        location=clean_location,
    )
    db.add(entry)
    db.flush()

    _upsert_best_time(
        db=db,
        person_id=person.id,
        sprint_entry_id=entry.id,
        sprint_time_ms=entry.sprint_time_ms,
    )

    db.commit()
    db.refresh(entry)

    return SprintRow(
        id=entry.id,
        name=person.name,
        sprint_time_ms=entry.sprint_time_ms,
        sprint_date=entry.sprint_date,
        location=entry.location,
        created_at=entry.created_at,
    )


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
    query = (
        db.query(
            PersonBestTime.person_id,
            PersonBestTime.sprint_entry_id,
            Person.name.label("name"),
            PersonBestTime.best_time_ms,
            SprintEntry.sprint_date,
            SprintEntry.location,
            PersonBestTime.updated_at,
        )
        .join(Person, Person.id == PersonBestTime.person_id)
        .join(SprintEntry, SprintEntry.id == PersonBestTime.sprint_entry_id)
    )

    query = _apply_common_person_entry_filters(
        query=query,
        name=name,
        location=location,
        date_from=date_from,
        date_to=date_to,
    )

    sort_columns = {
        "name": Person.name,
        "best_time_ms": PersonBestTime.best_time_ms,
        "sprint_date": SprintEntry.sprint_date,
        "location": SprintEntry.location,
        "updated_at": PersonBestTime.updated_at,
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


def _normalize_text(value: str) -> str:
    return value.strip()


def _apply_common_person_entry_filters(
    query: Query,
    name: str | None,
    location: str | None,
    date_from: date | None,
    date_to: date | None,
) -> Query:
    filters: list[Any] = []
    normalized_name = _normalize_optional_text(name)
    normalized_location = _normalize_optional_text(location)

    if normalized_name:
        filters.append(Person.name.ilike(f"%{normalized_name}%"))
    if normalized_location:
        filters.append(SprintEntry.location.ilike(f"%{normalized_location}%"))
    if date_from:
        filters.append(SprintEntry.sprint_date >= date_from)
    if date_to:
        filters.append(SprintEntry.sprint_date <= date_to)

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
    normalized = value.strip()
    return normalized or None


def _upsert_best_time(
    db: Session,
    person_id: int,
    sprint_entry_id: int,
    sprint_time_ms: int,
) -> None:
    statement = insert(PersonBestTime).values(
        person_id=person_id,
        sprint_entry_id=sprint_entry_id,
        best_time_ms=sprint_time_ms,
    )

    statement = statement.on_conflict_do_update(
        index_elements=[PersonBestTime.person_id],
        set_={
            "sprint_entry_id": sprint_entry_id,
            "best_time_ms": sprint_time_ms,
            "updated_at": func.now(),
        },
        where=statement.excluded.best_time_ms < PersonBestTime.best_time_ms,
    )

    db.execute(statement)
