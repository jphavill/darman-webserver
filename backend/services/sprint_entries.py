from sqlalchemy.orm import Session

from core.errors import AppError, NotFoundAppError, ValidationAppError
from core.text import collapse_whitespace
from models import Person, SprintEntry
from schemas import SprintCreateRequest, SprintRow, SprintUpdateRequest
from services.people_lookup import resolve_person_for_create, resolve_person_for_update


def create_sprint_entry(db: Session, payload: SprintCreateRequest) -> SprintRow:
    clean_location = collapse_whitespace(payload.location)
    if not clean_location:
        raise ValidationAppError("location cannot be empty")

    person = resolve_person_for_create(db=db, payload=payload)
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
        raise ValidationAppError("at least one field must be provided")

    entry = db.query(SprintEntry).filter(SprintEntry.id == sprint_id).one_or_none()
    if entry is None:
        raise NotFoundAppError("Sprint entry not found")

    person = resolve_person_for_update(db=db, payload=payload)
    if person is not None:
        entry.person_id = person.id
    if payload.sprint_time_ms is not None:
        entry.sprint_time_ms = payload.sprint_time_ms
    if payload.sprint_date is not None:
        entry.sprint_date = payload.sprint_date
    if payload.location is not None:
        clean_location = collapse_whitespace(payload.location)
        if not clean_location:
            raise ValidationAppError("location cannot be empty")
        entry.location = clean_location

    db.commit()
    db.refresh(entry)

    person_name = db.query(Person.name).filter(Person.id == entry.person_id).scalar()
    if person_name is None:
        raise AppError("Sprint entry has no person")

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
        raise NotFoundAppError("Sprint entry not found")

    db.delete(entry)
    db.commit()
