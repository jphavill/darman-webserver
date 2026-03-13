from datetime import date, datetime

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
