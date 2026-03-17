"""add photo captured_at

Revision ID: 20260317_0003
Revises: 20260314_0002
Create Date: 2026-03-17 00:00:03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0003"
down_revision = "20260314_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE photos SET captured_at = created_at WHERE captured_at IS NULL")
    op.alter_column("photos", "captured_at", nullable=False)
    op.create_index("ix_photos_published_captured", "photos", ["is_published", "captured_at", "created_at"], unique=False)
    op.drop_index("ix_photos_published_sort", table_name="photos")


def downgrade() -> None:
    op.create_index("ix_photos_published_sort", "photos", ["is_published", "sort_order", "created_at"], unique=False)
    op.drop_index("ix_photos_published_captured", table_name="photos")
    op.drop_column("photos", "captured_at")
