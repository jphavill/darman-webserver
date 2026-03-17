from datetime import date

from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from models import Person, PersonBestTime, Photo, SprintEntry


def test_model_relationships_persist(db_session):
    person = Person(name="Jason")
    db_session.add(person)
    db_session.flush()

    entry = SprintEntry(
        person_id=person.id,
        sprint_time_ms=10234,
        sprint_date=date(2026, 3, 12),
        location="Track A",
    )
    db_session.add(entry)
    db_session.flush()

    best = PersonBestTime(person_id=person.id, sprint_entry_id=entry.id, best_time_ms=entry.sprint_time_ms)
    db_session.add(best)
    db_session.commit()

    loaded_person = db_session.query(Person).filter_by(name="Jason").one()
    assert loaded_person.entries[0].location == "Track A"
    assert loaded_person.best_time.best_time_ms == 10234


def test_sprint_time_positive_constraint(db_session):
    person = Person(name="Robin")
    db_session.add(person)
    db_session.flush()

    invalid_entry = SprintEntry(
        person_id=person.id,
        sprint_time_ms=0,
        sprint_date=date(2026, 3, 12),
        location="Track B",
    )
    db_session.add(invalid_entry)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_photo_model_persists(db_session):
    photo = Photo(
        id=uuid4(),
        alt_text="Ridge line",
        caption="Cloud cover breaking",
        thumb_url="/media/gallery/ridge-thumb.webp",
        full_url="/media/gallery/ridge-full.webp",
        sort_order=12,
        is_published=True,
    )

    db_session.add(photo)
    db_session.commit()

    loaded = db_session.query(Photo).filter_by(id=photo.id).one()
    assert loaded.thumb_url.endswith("thumb.webp")
