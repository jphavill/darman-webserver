from datetime import date, datetime, timezone

from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from models import Person, Photo, Project, ProjectImage, ProjectLink, SprintEntry


def test_model_relationships_persist(db_session):
    person = Person(name="Jason", normalized_name="jason", is_active=True)
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

    db_session.commit()

    loaded_person = db_session.query(Person).filter_by(name="Jason").one()
    assert loaded_person.entries[0].location == "Track A"
    assert loaded_person.normalized_name == "jason"


def test_sprint_time_positive_constraint(db_session):
    person = Person(name="Robin", normalized_name="robin", is_active=True)
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


def test_people_normalized_name_is_unique(db_session):
    db_session.add(Person(name="Jason", normalized_name="jason", is_active=True))
    db_session.commit()

    db_session.add(Person(name="JASON", normalized_name="jason", is_active=True))
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
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )

    db_session.add(photo)
    db_session.commit()

    loaded = db_session.query(Photo).filter_by(id=photo.id).one()
    assert loaded.thumb_url.endswith("thumb.webp")


def test_project_models_persist(db_session):
    project = Project(
        id=uuid4(),
        title="Demo",
        short_description="Short",
        long_description_md="Hello",
        type="software",
        is_published=True,
        sort_order=0,
    )
    db_session.add(project)
    db_session.flush()

    db_session.add(
        ProjectLink(
            id=uuid4(),
            project_id=project.id,
            type="website",
            label="Live",
            url="https://example.com",
            sort_order=0,
        )
    )
    db_session.add(
        ProjectImage(
            id=uuid4(),
            project_id=project.id,
            thumb_url="/media/projects/a-thumb.webp",
            full_url="/media/projects/a-full.webp",
            alt_text="Hero",
            caption="Cap",
            sort_order=0,
            is_hero=True,
        )
    )
    db_session.commit()

    loaded = db_session.query(Project).filter_by(id=project.id).one()
    assert loaded.links[0].type == "website"
    assert loaded.images[0].is_hero is True
