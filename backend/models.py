import uuid

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    entries = relationship("SprintEntry", back_populates="person")
    best_time = relationship("PersonBestTime", back_populates="person", uselist=False)


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
    best_for_person = relationship("PersonBestTime", back_populates="entry", uselist=False)


class PersonBestTime(Base):
    __tablename__ = "person_best_times"
    __table_args__ = (CheckConstraint("best_time_ms > 0", name="ck_person_best_times_positive"),)

    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sprint_entry_id: Mapped[int] = mapped_column(
        ForeignKey("sprint_entries.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    best_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    person = relationship("Person", back_populates="best_time")
    entry = relationship("SprintEntry", back_populates="best_for_person")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alt_text: Mapped[str] = mapped_column(String(240), nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=False)
    thumb_url: Mapped[str] = mapped_column(String(400), nullable=False)
    full_url: Mapped[str] = mapped_column(String(400), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
