"""remove photos.sort_order

Revision ID: 20260320_0005
Revises: 20260319_0004
Create Date: 2026-03-20 00:00:05
"""

from alembic import op
import sqlalchemy as sa


revision = "20260320_0005"
down_revision = "20260319_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("photos", "sort_order")


def downgrade() -> None:
    op.add_column("photos", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
