"""create sprint tables

Revision ID: 20260312_0001
Revises:
Create Date: 2026-03-12 00:00:01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "people",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_people_name"), "people", ["name"], unique=False)

    op.create_table(
        "sprint_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("sprint_time_ms", sa.Integer(), nullable=False),
        sa.Column("sprint_date", sa.Date(), nullable=False),
        sa.Column("location", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("sprint_time_ms > 0", name="ck_sprint_entries_time_positive"),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sprint_entries_location"), "sprint_entries", ["location"], unique=False)
    op.create_index(op.f("ix_sprint_entries_person_id"), "sprint_entries", ["person_id"], unique=False)
    op.create_index(op.f("ix_sprint_entries_sprint_date"), "sprint_entries", ["sprint_date"], unique=False)
    op.create_index("ix_sprint_entries_person_time", "sprint_entries", ["person_id", "sprint_time_ms"], unique=False)

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


def downgrade() -> None:
    op.drop_table("person_best_times")
    op.drop_index("ix_sprint_entries_person_time", table_name="sprint_entries")
    op.drop_index(op.f("ix_sprint_entries_sprint_date"), table_name="sprint_entries")
    op.drop_index(op.f("ix_sprint_entries_person_id"), table_name="sprint_entries")
    op.drop_index(op.f("ix_sprint_entries_location"), table_name="sprint_entries")
    op.drop_table("sprint_entries")
    op.drop_index(op.f("ix_people_name"), table_name="people")
    op.drop_table("people")
