from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Person
from schemas import PersonRow
from services.sprints import normalize_name


def list_people(db: Session, q: str | None, limit: int) -> list[PersonRow]:
    query = db.query(Person).filter(Person.is_active.is_(True))

    normalized_query = normalize_name(q) if q is not None else ""
    if normalized_query:
        query = query.filter(Person.normalized_name.like(f"{normalized_query}%"))

    records = query.order_by(Person.name.asc(), Person.id.asc()).limit(limit).all()
    return [PersonRow(id=record.id, name=record.name) for record in records]


def delete_person(db: Session, person_id: int) -> None:
    person = db.query(Person).filter(Person.id == person_id).one_or_none()
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    db.delete(person)
    db.commit()
