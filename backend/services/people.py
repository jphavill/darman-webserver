from sqlalchemy.orm import Session

from core.errors import NotFoundAppError, ValidationAppError
from core.text import collapse_whitespace, normalize_name
from models import Person
from schemas import PersonCreateRequest, PersonRow


def list_people(db: Session, q: str | None, limit: int) -> list[PersonRow]:
    query = db.query(Person).filter(Person.is_active.is_(True))

    normalized_query = normalize_name(q) if q is not None else ""
    if normalized_query:
        query = query.filter(Person.normalized_name.like(f"{normalized_query}%"))

    records = query.order_by(Person.name.asc(), Person.id.asc()).limit(limit).all()
    return [PersonRow(id=record.id, name=record.name) for record in records]


def create_person(db: Session, payload: PersonCreateRequest) -> PersonRow:
    display_name = collapse_whitespace(payload.name)
    normalized_name = normalize_name(payload.name)
    if not display_name or not normalized_name:
        raise ValidationAppError("name cannot be empty")

    person = db.query(Person).filter(Person.normalized_name == normalized_name).one_or_none()
    if person is not None:
        if not person.is_active:
            person.is_active = True
            db.commit()
            db.refresh(person)
        return PersonRow(id=person.id, name=person.name)

    person = Person(name=display_name, normalized_name=normalized_name, is_active=True)
    db.add(person)
    db.commit()
    db.refresh(person)
    return PersonRow(id=person.id, name=person.name)


def delete_person(db: Session, person_id: int) -> None:
    person = db.query(Person).filter(Person.id == person_id).one_or_none()
    if person is None:
        raise NotFoundAppError("Person not found")

    db.delete(person)
    db.commit()
