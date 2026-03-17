from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SprintCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sprint_time_ms: int = Field(gt=0)
    sprint_date: date
    location: str = Field(min_length=1, max_length=160)


class SprintRow(BaseModel):
    id: int
    name: str
    sprint_time_ms: int
    sprint_date: date
    location: str
    created_at: datetime


class SprintListResponse(BaseModel):
    rows: list[SprintRow]
    total: int


class BestTimeRow(BaseModel):
    person_id: int
    sprint_entry_id: int
    name: str
    best_time_ms: int
    sprint_date: date
    location: str
    updated_at: datetime


class BestTimesResponse(BaseModel):
    rows: list[BestTimeRow]
    total: int


class PhotoUpsertItem(BaseModel):
    id: UUID
    alt_text: str = Field(min_length=1, max_length=240)
    caption: str = Field(min_length=1)
    thumb_url: str = Field(min_length=1, max_length=400)
    full_url: str = Field(min_length=1, max_length=400)
    sort_order: int = Field(default=0)
    is_published: bool = Field(default=True)


class PhotoBatchUpsertRequest(BaseModel):
    rows: list[PhotoUpsertItem] = Field(min_length=1)


class PhotoRow(BaseModel):
    id: UUID
    alt_text: str
    caption: str
    thumb_url: str
    full_url: str
    sort_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime


class PhotoListResponse(BaseModel):
    rows: list[PhotoRow]
    total: int
