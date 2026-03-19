from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class SprintCreateRequest(BaseModel):
    person_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sprint_time_ms: int = Field(gt=0)
    sprint_date: date
    location: str = Field(min_length=1, max_length=160)

    @model_validator(mode="after")
    def validate_person_identity(self) -> "SprintCreateRequest":
        if self.person_id is None and self.name is None:
            raise ValueError("either person_id or name must be provided")
        if self.name is not None and not _collapse_whitespace(self.name):
            raise ValueError("name cannot be empty")
        return self


class SprintUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    sprint_time_ms: Optional[int] = Field(default=None, gt=0)
    sprint_date: Optional[date] = None
    location: Optional[str] = Field(default=None, min_length=1, max_length=160)


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


class PersonRow(BaseModel):
    id: int
    name: str


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


ComparisonMode = Literal["progression", "daily_best"]
RunWindow = Literal["all", "10", "20", "50"]


class SprintComparisonPoint(BaseModel):
    x: int | str
    y: int
    label: str | None = None


class SprintComparisonSeries(BaseModel):
    person_id: int
    person_name: str
    points: list[SprintComparisonPoint]


class SprintComparisonResponse(BaseModel):
    mode: ComparisonMode
    location: str | None
    run_window: RunWindow
    series: list[SprintComparisonSeries]


class PhotoUpsertItem(BaseModel):
    id: UUID
    alt_text: str = Field(min_length=1, max_length=240)
    caption: str = Field(min_length=1)
    thumb_url: str = Field(min_length=1, max_length=400)
    full_url: str = Field(min_length=1, max_length=400)
    captured_at: datetime
    is_published: bool = Field(default=True)


class PhotoBatchUpsertRequest(BaseModel):
    rows: list[PhotoUpsertItem] = Field(min_length=1)


class PhotoUpdateRequest(BaseModel):
    alt_text: Optional[str] = Field(default=None, min_length=1, max_length=240)
    caption: Optional[str] = Field(default=None, min_length=1)
    thumb_url: Optional[str] = Field(default=None, min_length=1, max_length=400)
    full_url: Optional[str] = Field(default=None, min_length=1, max_length=400)
    captured_at: Optional[datetime] = None
    is_published: Optional[bool] = None


class PhotoRow(BaseModel):
    id: UUID
    alt_text: str
    caption: str
    thumb_url: str
    full_url: str
    captured_at: datetime
    is_published: bool
    created_at: datetime
    updated_at: datetime


class PhotoListResponse(BaseModel):
    rows: list[PhotoRow]
    total: int


def _collapse_whitespace(value: str) -> str:
    return " ".join(value.strip().split())
