from pydantic import ValidationError

from models import Person
from schemas import PersonCreateRequest
from services.people import create_person


def test_create_person_creates_new_active_person(db_session):
    created = create_person(db_session, PersonCreateRequest(name="Taylor"))

    record = db_session.query(Person).filter(Person.id == created.id).one()
    assert record.name == "Taylor"
    assert record.normalized_name == "taylor"
    assert record.is_active is True


def test_create_person_returns_existing_person_idempotently(db_session):
    first = create_person(db_session, PersonCreateRequest(name="  JaSon   Doe "))
    second = create_person(db_session, PersonCreateRequest(name="jason doe"))

    assert first.id == second.id
    assert first.name == second.name
    assert db_session.query(Person).count() == 1


def test_create_person_reactivates_inactive_person(db_session):
    existing = Person(name="Alex", normalized_name="alex", is_active=False)
    db_session.add(existing)
    db_session.commit()

    created = create_person(db_session, PersonCreateRequest(name="alex"))
    refreshed = db_session.query(Person).filter(Person.id == existing.id).one()

    assert created.id == existing.id
    assert refreshed.is_active is True


def test_create_person_rejects_blank_name(db_session):
    try:
        create_person(db_session, PersonCreateRequest(name="   "))
    except ValidationError:
        return
    else:
        raise AssertionError("expected validation error")
