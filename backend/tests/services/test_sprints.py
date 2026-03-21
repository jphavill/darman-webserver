from datetime import date

from core.errors import ValidationAppError

from models import Person, SprintEntry
from schemas import SprintCreateRequest, SprintUpdateRequest
from services.sprints import create_sprint_entry, list_best_times, list_sprints, update_sprint_entry


def test_create_sprint_entry_with_existing_person_id(db_session):
    person = Person(name="Alex", normalized_name="alex", is_active=True)
    db_session.add(person)
    db_session.flush()

    created = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            person_id=person.id,
            sprint_time_ms=10400,
            sprint_date=date(2026, 3, 1),
            location="Track A",
        ),
    )

    assert created.name == "Alex"
    assert created.sprint_time_ms == 10400


def test_create_sprint_entry_creates_person_from_name(db_session):
    created = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            name="Taylor",
            sprint_time_ms=9800,
            sprint_date=date(2026, 3, 2),
            location="Track B",
        ),
    )

    people = db_session.query(Person).all()
    assert len(people) == 1
    assert people[0].name == "Taylor"
    assert people[0].normalized_name == "taylor"
    assert created.name == "Taylor"


def test_create_sprint_entry_reuses_person_by_normalized_name(db_session):
    first = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            name="  JaSon  Havill ",
            sprint_time_ms=10400,
            sprint_date=date(2026, 3, 1),
            location="Track A",
        ),
    )
    second = create_sprint_entry(
        db_session,
        SprintCreateRequest(
            name="jason havill",
            sprint_time_ms=9800,
            sprint_date=date(2026, 3, 2),
            location="Track B",
        ),
    )

    people = db_session.query(Person).all()
    assert len(people) == 1
    assert first.name == "JaSon Havill"
    assert second.name == "JaSon Havill"


def test_create_sprint_entry_rejects_invalid_person_id(db_session):
    try:
        create_sprint_entry(
            db_session,
            SprintCreateRequest(
                person_id=999,
                sprint_time_ms=9800,
                sprint_date=date(2026, 3, 2),
                location="Track B",
            ),
        )
    except ValidationAppError as exc:
        assert exc.status_code == 422
        assert exc.detail == "person_id is invalid"
    else:
        raise AssertionError("expected HTTPException")


def test_list_sprints_filters_and_orders(db_session):
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Avery", sprint_time_ms=10000, sprint_date=date(2026, 3, 1), location="North"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Avery", sprint_time_ms=9700, sprint_date=date(2026, 3, 2), location="North"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Jordan", sprint_time_ms=9900, sprint_date=date(2026, 3, 2), location="South"),
    )

    result = list_sprints(
        db=db_session,
        limit=5,
        offset=0,
        sort_by="sprint_time_ms",
        sort_dir="asc",
        name="Avery",
        location="North",
        date_from=None,
        date_to=None,
        min_time_ms=9600,
        max_time_ms=10000,
    )

    assert result.total == 2
    assert result.rows[0].sprint_time_ms == 9700
    assert result.rows[1].sprint_time_ms == 10000


def test_list_best_times_uses_aggregate_when_multiple_entries_exist(db_session):
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Taylor", sprint_time_ms=10400, sprint_date=date(2026, 3, 1), location="Track A"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Taylor", sprint_time_ms=9800, sprint_date=date(2026, 3, 2), location="Track B"),
    )

    best = list_best_times(
        db=db_session,
        limit=10,
        offset=0,
        sort_by="best_time_ms",
        sort_dir="asc",
        name="Taylor",
        location=None,
        date_from=None,
        date_to=None,
    )
    assert best.total == 1
    assert best.rows[0].best_time_ms == 9800


def test_existing_sprint_history_resolves_display_name(db_session):
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Chris Doe", sprint_time_ms=10100, sprint_date=date(2026, 3, 1), location="Track A"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="chris   doe", sprint_time_ms=10000, sprint_date=date(2026, 3, 2), location="Track B"),
    )

    result = list_sprints(
        db=db_session,
        limit=10,
        offset=0,
        sort_by="created_at",
        sort_dir="asc",
        name=None,
        location=None,
        date_from=None,
        date_to=None,
        min_time_ms=None,
        max_time_ms=None,
    )

    assert result.total == 2
    assert {row.name for row in result.rows} == {"Chris Doe"}


def test_update_sprint_entry_reassigns_to_existing_person_name(db_session):
    original = create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Alex", sprint_time_ms=10100, sprint_date=date(2026, 3, 1), location="Track A"),
    )
    create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Jamie", sprint_time_ms=9900, sprint_date=date(2026, 3, 2), location="Track B"),
    )

    updated = update_sprint_entry(db_session, original.id, SprintUpdateRequest(name="Jamie"))
    jamie = db_session.query(Person).filter(Person.normalized_name == "jamie").one()
    entry = db_session.query(SprintEntry).filter(SprintEntry.id == original.id).one()

    assert updated.name == "Jamie"
    assert entry.person_id == jamie.id


def test_update_sprint_entry_rejects_unknown_name(db_session):
    original = create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Alex", sprint_time_ms=10100, sprint_date=date(2026, 3, 1), location="Track A"),
    )

    try:
        update_sprint_entry(db_session, original.id, SprintUpdateRequest(name="Does Not Exist"))
    except ValidationAppError as exc:
        assert exc.status_code == 422
        assert exc.detail == "person name does not exist"
    else:
        raise AssertionError("expected HTTPException")


def test_update_sprint_entry_supports_person_id_for_active_person(db_session):
    original = create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Alex", sprint_time_ms=10100, sprint_date=date(2026, 3, 1), location="Track A"),
    )
    jamie = Person(name="Jamie", normalized_name="jamie", is_active=True)
    db_session.add(jamie)
    db_session.commit()

    updated = update_sprint_entry(db_session, original.id, SprintUpdateRequest(person_id=jamie.id))
    entry = db_session.query(SprintEntry).filter(SprintEntry.id == original.id).one()

    assert updated.name == "Jamie"
    assert entry.person_id == jamie.id


def test_update_sprint_entry_rejects_inactive_person_id(db_session):
    original = create_sprint_entry(
        db_session,
        SprintCreateRequest(name="Alex", sprint_time_ms=10100, sprint_date=date(2026, 3, 1), location="Track A"),
    )
    inactive = Person(name="Retired", normalized_name="retired", is_active=False)
    db_session.add(inactive)
    db_session.commit()

    try:
        update_sprint_entry(db_session, original.id, SprintUpdateRequest(person_id=inactive.id))
    except ValidationAppError as exc:
        assert exc.status_code == 422
        assert exc.detail == "person_id is invalid"
    else:
        raise AssertionError("expected HTTPException")
