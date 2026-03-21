from sqlalchemy.orm import Session

from core.errors import ValidationAppError
from core.text import collapse_whitespace, normalize_name
from models import Person
from schemas import SprintCreateRequest, SprintUpdateRequest


def get_person_by_id(db: Session, person_id: int) -> Person | None:
    return db.query(Person).filter(Person.id == person_id).one_or_none()


def get_person_by_normalized_name(db: Session, normalized_person_name: str) -> Person | None:
    return db.query(Person).filter(Person.normalized_name == normalized_person_name).one_or_none()


def get_or_create_person_by_name(db: Session, raw_name: str) -> Person:
    display_name = collapse_whitespace(raw_name)
    canonical_name = normalize_name(raw_name)
    if not display_name or not canonical_name:
        raise ValidationAppError("name cannot be empty")

    person = get_person_by_normalized_name(db=db, normalized_person_name=canonical_name)
    if person is not None:
        return person

    person = Person(name=display_name, normalized_name=canonical_name, is_active=True)
    db.add(person)
    db.flush()
    return person


def resolve_person_for_create(db: Session, payload: SprintCreateRequest) -> Person:
    if payload.person_id is not None:
        person = get_person_by_id(db=db, person_id=payload.person_id)
        if person is None:
            raise ValidationAppError("person_id is invalid")
        return person

    if payload.name is None:
        raise ValidationAppError("either person_id or name must be provided")
    return get_or_create_person_by_name(db=db, raw_name=payload.name)


def resolve_person_for_update(db: Session, payload: SprintUpdateRequest) -> Person | None:
    if payload.person_id is not None:
        person = (
            db.query(Person)
            .filter(Person.id == payload.person_id, Person.is_active.is_(True))
            .one_or_none()
        )
        if person is None:
            raise ValidationAppError("person_id is invalid")
        return person

    if payload.name is None:
        return None

    canonical_name = normalize_name(payload.name)
    if not canonical_name:
        raise ValidationAppError("name cannot be empty")

    person = (
        db.query(Person)
        .filter(Person.normalized_name == canonical_name, Person.is_active.is_(True))
        .one_or_none()
    )
    if person is None:
        raise ValidationAppError("person name does not exist")
    return person
