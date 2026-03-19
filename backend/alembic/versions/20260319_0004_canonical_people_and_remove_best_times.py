"""canonical people and remove best-times table

Revision ID: 20260319_0004
Revises: 20260317_0003
Create Date: 2026-03-19 00:00:04
"""

from alembic import op
import sqlalchemy as sa


revision = "20260319_0004"
down_revision = "20260317_0003"
branch_labels = None
depends_on = None


def normalize_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    op.add_column("people", sa.Column("normalized_name", sa.String(length=120), nullable=True))
    op.add_column("people", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    rows = bind.execute(sa.text("SELECT id, name FROM people ORDER BY id ASC")).mappings().all()
    names_by_normalized: dict[str, list[tuple[int, str]]] = {}

    for row in rows:
        normalized = normalize_name(row["name"])
        if not normalized:
            raise RuntimeError(f"Cannot normalize people.name for id={row['id']}: name is blank")
        names_by_normalized.setdefault(normalized, []).append((row["id"], row["name"]))

    conflicts = {key: value for key, value in names_by_normalized.items() if len(value) > 1}
    if conflicts:
        formatted_conflicts = "; ".join(
            f"normalized_name='{normalized}' -> {entries}" for normalized, entries in sorted(conflicts.items())
        )
        raise RuntimeError(
            "Cannot migrate people.normalized_name due to duplicate canonical names. "
            f"Conflicts: {formatted_conflicts}"
        )

    for normalized, entries in names_by_normalized.items():
        person_id = entries[0][0]
        bind.execute(
            sa.text("UPDATE people SET normalized_name = :normalized_name WHERE id = :person_id"),
            {"normalized_name": normalized, "person_id": person_id},
        )

    for constraint in inspector.get_unique_constraints("people"):
        if constraint.get("column_names") == ["name"] and constraint.get("name"):
            op.drop_constraint(constraint["name"], "people", type_="unique")

    op.alter_column("people", "normalized_name", nullable=False)
    op.create_index("ix_people_normalized_name", "people", ["normalized_name"], unique=True)

    op.execute("DROP TABLE IF EXISTS person_best_times CASCADE")


def downgrade() -> None:
    op.create_table(
        "person_best_times",
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("sprint_entry_id", sa.Integer(), nullable=False),
        sa.Column("best_time_ms", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("best_time_ms > 0", name="ck_person_best_times_positive"),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sprint_entry_id"], ["sprint_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("person_id"),
        sa.UniqueConstraint("sprint_entry_id"),
    )

    op.drop_index("ix_people_normalized_name", table_name="people")
    op.drop_column("people", "is_active")
    op.drop_column("people", "normalized_name")
    op.create_unique_constraint("people_name_key", "people", ["name"])
