"""create photos table

Revision ID: 20260314_0002
Revises: 20260312_0001
Create Date: 2026-03-14 00:00:02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260314_0002"
down_revision = "20260312_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alt_text", sa.String(length=240), nullable=False),
        sa.Column("caption", sa.Text(), nullable=False),
        sa.Column("thumb_url", sa.String(length=400), nullable=False),
        sa.Column("full_url", sa.String(length=400), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_photos_published_sort", "photos", ["is_published", "sort_order", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_photos_published_sort", table_name="photos")
    op.drop_table("photos")
