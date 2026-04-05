"""create projects tables

Revision ID: 20260405_0007
Revises: 20260405_0006
Create Date: 2026-04-05 00:00:07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260405_0007"
down_revision = "20260405_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("short_description", sa.String(length=500), nullable=False),
        sa.Column("long_description_md", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("type IN ('software', 'physical')", name="ck_projects_type_valid"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_type_published_sort", "projects", ["type", "is_published", "sort_order"], unique=False)

    op.create_table(
        "project_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thumb_url", sa.String(length=400), nullable=False),
        sa.Column("full_url", sa.String(length=400), nullable=False),
        sa.Column("alt_text", sa.String(length=240), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_hero", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_images_project_sort", "project_images", ["project_id", "sort_order"], unique=False)
    op.create_index(
        "ux_project_images_one_hero_per_project",
        "project_images",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("is_hero = true"),
    )

    op.create_table(
        "project_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("type IN ('github', 'website', 'cults3d', 'other')", name="ck_project_links_type_valid"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_links_project_sort", "project_links", ["project_id", "sort_order"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_project_links_project_sort", table_name="project_links")
    op.drop_table("project_links")

    op.drop_index("ux_project_images_one_hero_per_project", table_name="project_images")
    op.drop_index("ix_project_images_project_sort", table_name="project_images")
    op.drop_table("project_images")

    op.drop_index("ix_projects_type_published_sort", table_name="projects")
    op.drop_table("projects")
