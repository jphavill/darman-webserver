import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    entries = relationship("SprintEntry", back_populates="person", passive_deletes=True)


class SprintEntry(Base):
    __tablename__ = "sprint_entries"
    __table_args__ = (CheckConstraint("sprint_time_ms > 0", name="ck_sprint_entries_time_positive"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sprint_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    sprint_date: Mapped[Date] = mapped_column(Date, index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    person = relationship("Person", back_populates="entries")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alt_text: Mapped[str] = mapped_column(String(240), nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=False)
    thumb_url: Mapped[str] = mapped_column(String(400), nullable=False)
    full_url: Mapped[str] = mapped_column(String(400), nullable=False)
    captured_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    csrf_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    revoked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("type IN ('software', 'physical')", name="ck_projects_type_valid"),
        Index("ix_projects_type_published_sort", "type", "is_published", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    short_description: Mapped[str] = mapped_column(String(500), nullable=False)
    long_description_md: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    images = relationship(
        "ProjectImage",
        back_populates="project",
        passive_deletes=True,
        order_by="ProjectImage.sort_order",
    )
    links = relationship(
        "ProjectLink",
        back_populates="project",
        passive_deletes=True,
        order_by="ProjectLink.sort_order",
    )


class ProjectImage(Base):
    __tablename__ = "project_images"
    __table_args__ = (
        Index("ix_project_images_project_sort", "project_id", "sort_order"),
        Index(
            "ux_project_images_one_hero_per_project",
            "project_id",
            unique=True,
            postgresql_where=text("is_hero = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    thumb_url: Mapped[str] = mapped_column(String(400), nullable=False)
    full_url: Mapped[str] = mapped_column(String(400), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(240), nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_hero: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    project = relationship("Project", back_populates="images")


class ProjectLink(Base):
    __tablename__ = "project_links"
    __table_args__ = (
        CheckConstraint("type IN ('github', 'website', 'cults3d', 'other')", name="ck_project_links_type_valid"),
        Index("ix_project_links_project_sort", "project_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="links")
