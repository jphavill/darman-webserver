from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from core.text import collapse_whitespace


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
    person_id: Optional[int] = Field(default=None, gt=0)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    sprint_time_ms: Optional[int] = Field(default=None, gt=0)
    sprint_date: Optional[date] = None
    location: Optional[str] = Field(default=None, min_length=1, max_length=160)

    @model_validator(mode="after")
    def validate_person_identity_update(self) -> "SprintUpdateRequest":
        if self.person_id is not None and self.name is not None:
            raise ValueError("provide either person_id or name, not both")
        if self.name is not None and not _collapse_whitespace(self.name):
            raise ValueError("name cannot be empty")
        return self


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


SortDirection = Literal["asc", "desc"]
SprintSortBy = Literal["name", "sprint_time_ms", "sprint_date", "location", "created_at"]
BestSortBy = Literal["name", "best_time_ms", "sprint_date", "location", "updated_at"]
TextFilterType = Literal[
    "contains",
    "notContains",
    "equals",
    "notEqual",
    "startsWith",
    "endsWith",
    "blank",
    "notBlank",
]


class SprintListQuery(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    sort_by: SprintSortBy = "sprint_date"
    sort_dir: SortDirection = "desc"
    name: str | None = None
    name_filter_type: TextFilterType = "contains"
    location: str | None = None
    location_filter_type: TextFilterType = "contains"
    date_from: date | None = None
    date_to: date | None = None
    date_not: date | None = None
    min_time_ms: int | None = Field(default=None, gt=0)
    max_time_ms: int | None = Field(default=None, gt=0)


class BestTimesQuery(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    sort_by: BestSortBy = "best_time_ms"
    sort_dir: SortDirection = "asc"
    name: str | None = None
    name_filter_type: TextFilterType = "contains"
    location: str | None = None
    location_filter_type: TextFilterType = "contains"
    date_from: date | None = None
    date_to: date | None = None
    date_not: date | None = None


class PersonRow(BaseModel):
    id: int
    name: str


class PersonCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @model_validator(mode="after")
    def validate_name(self) -> "PersonCreateRequest":
        if not _collapse_whitespace(self.name):
            raise ValueError("name cannot be empty")
        return self


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


class PeopleListQuery(BaseModel):
    q: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


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


class SprintComparisonQuery(BaseModel):
    mode: ComparisonMode = "progression"
    person_ids: str = Field(min_length=1)
    location: str | None = None
    run_window: RunWindow = "all"

    def parsed_person_ids(self) -> list[int]:
        values = [chunk.strip() for chunk in self.person_ids.split(",")]
        if any(not value for value in values):
            raise ValueError("person_ids must be a comma-separated list of integers")

        try:
            parsed = [int(value) for value in values]
        except ValueError as exc:
            raise ValueError("person_ids must be a comma-separated list of integers") from exc

        return parsed


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


class PhotoListQuery(BaseModel):
    limit: int = Field(default=60, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    include_unpublished: bool = Field(default=False)


class AdminFeatureFlags(BaseModel):
    photos_view_unpublished: bool = True
    photos_manage_publication: bool = True


class AdminSessionResponse(BaseModel):
    feature_flags: AdminFeatureFlags


class AdminSessionCreateRequest(BaseModel):
    api_key: str = Field(min_length=1)


def _collapse_whitespace(value: str) -> str:
    return collapse_whitespace(value)
