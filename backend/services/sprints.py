from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Query, Session

from models import Person, SprintEntry
from schemas import (
    BestTimeRow,
    BestTimesResponse,
    SprintCreateRequest,
    SprintListResponse,
    SprintRow,
    SprintUpdateRequest,
)


def create_sprint_entry(db: Session, payload: SprintCreateRequest) -> SprintRow:
    clean_location = _normalize_text(payload.location)
    if not clean_location:
        raise HTTPException(status_code=422, detail="location cannot be empty")

    person = _resolve_person_for_create(db=db, payload=payload)

    entry = SprintEntry(
        person_id=person.id,
        sprint_time_ms=payload.sprint_time_ms,
        sprint_date=payload.sprint_date,
        location=clean_location,
    )
    db.add(entry)

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


def update_sprint_entry(db: Session, sprint_id: int, payload: SprintUpdateRequest) -> SprintRow:
    if not payload.model_fields_set:
        raise HTTPException(status_code=422, detail="at least one field must be provided")

    entry = db.query(SprintEntry).filter(SprintEntry.id == sprint_id).one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Sprint entry not found")

    if payload.name is not None:
        person = get_or_create_person_by_name(db=db, raw_name=payload.name)
        entry.person_id = person.id

    if payload.sprint_time_ms is not None:
        entry.sprint_time_ms = payload.sprint_time_ms

    if payload.sprint_date is not None:
        entry.sprint_date = payload.sprint_date

    if payload.location is not None:
        clean_location = _normalize_text(payload.location)
        if not clean_location:
            raise HTTPException(status_code=422, detail="location cannot be empty")
        entry.location = clean_location

    db.commit()
    db.refresh(entry)

    person_name = db.query(Person.name).filter(Person.id == entry.person_id).scalar()
    if person_name is None:
        raise HTTPException(status_code=500, detail="Sprint entry has no person")

    return SprintRow(
        id=entry.id,
        name=person_name,
        sprint_time_ms=entry.sprint_time_ms,
        sprint_date=entry.sprint_date,
        location=entry.location,
        created_at=entry.created_at,
    )


def delete_sprint_entry(db: Session, sprint_id: int) -> None:
    entry = db.query(SprintEntry).filter(SprintEntry.id == sprint_id).one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Sprint entry not found")

    db.delete(entry)
    db.commit()


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


def normalize_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def get_person_by_id(db: Session, person_id: int) -> Person | None:
    return db.query(Person).filter(Person.id == person_id).one_or_none()


def get_person_by_normalized_name(db: Session, normalized_name: str) -> Person | None:
    return db.query(Person).filter(Person.normalized_name == normalized_name).one_or_none()


def get_or_create_person_by_name(db: Session, raw_name: str) -> Person:
    display_name = _normalize_text(raw_name)
    canonical_name = normalize_name(raw_name)
    if not display_name or not canonical_name:
        raise HTTPException(status_code=422, detail="name cannot be empty")

    person = get_person_by_normalized_name(db=db, normalized_name=canonical_name)
    if person is not None:
        return person

    person = Person(name=display_name, normalized_name=canonical_name, is_active=True)
    db.add(person)
    db.flush()
    return person


def _resolve_person_for_create(db: Session, payload: SprintCreateRequest) -> Person:
    if payload.person_id is not None:
        person = get_person_by_id(db=db, person_id=payload.person_id)
        if person is None:
            raise HTTPException(status_code=422, detail="person_id is invalid")
        return person

    if payload.name is None:
        raise HTTPException(status_code=422, detail="either person_id or name must be provided")
    return get_or_create_person_by_name(db=db, raw_name=payload.name)


def _normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


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
    normalized = _normalize_text(value)
    return normalized or None
