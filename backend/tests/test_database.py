from sqlalchemy import text


def test_session_local_connects(db_session):
    result = db_session.execute(text("SELECT 1")).scalar_one()
    assert result == 1


def test_get_db_yields_session():
    from database import get_db

    generator = get_db()
    session = next(generator)
    try:
        value = session.execute(text("SELECT 1")).scalar_one()
        assert value == 1
    finally:
        try:
            next(generator)
        except StopIteration:
            pass
