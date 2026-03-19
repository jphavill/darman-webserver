from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_write_token
from database import get_db
from schemas import BestTimesResponse, SprintCreateRequest, SprintListResponse, SprintRow, SprintUpdateRequest
from schemas import ComparisonMode, RunWindow, SprintComparisonResponse
from services.sprints import (
    create_sprint_entry,
    delete_sprint_entry,
    list_best_times,
    list_sprint_comparison,
    list_sprints,
    update_sprint_entry,
)


router = APIRouter(prefix="/v1/sprints", tags=["sprints"])
SortDirection = Literal["asc", "desc"]
SprintSortBy = Literal["name", "sprint_time_ms", "sprint_date", "location", "created_at"]
BestSortBy = Literal["name", "best_time_ms", "sprint_date", "location", "updated_at"]


@router.post("", response_model=SprintRow)
def create_sprint_entry_route(
    payload: SprintCreateRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> SprintRow:
    return create_sprint_entry(db=db, payload=payload)


@router.post("/{sprint_id}", response_model=SprintRow)
def update_sprint_entry_route(
    sprint_id: int,
    payload: SprintUpdateRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> SprintRow:
    return update_sprint_entry(db=db, sprint_id=sprint_id, payload=payload)


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint_entry_route(
    sprint_id: int,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> Response:
    delete_sprint_entry(db=db, sprint_id=sprint_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=SprintListResponse)
def list_sprints_route(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sort_by: SprintSortBy = "sprint_date",
    sort_dir: SortDirection = "desc",
    name: str | None = None,
    location: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_time_ms: int | None = Query(default=None, gt=0),
    max_time_ms: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> SprintListResponse:
    return list_sprints(
        db=db,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_dir=sort_dir,
        name=name,
        location=location,
        date_from=date_from,
        date_to=date_to,
        min_time_ms=min_time_ms,
        max_time_ms=max_time_ms,
    )


@router.get("/best", response_model=BestTimesResponse)
def list_best_times_route(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sort_by: BestSortBy = "best_time_ms",
    sort_dir: SortDirection = "asc",
    name: str | None = None,
    location: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
) -> BestTimesResponse:
    return list_best_times(
        db=db,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_dir=sort_dir,
        name=name,
        location=location,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/comparison", response_model=SprintComparisonResponse)
def list_sprint_comparison_route(
    mode: ComparisonMode = Query(default="progression"),
    person_ids: str = Query(..., min_length=1),
    location: str | None = None,
    run_window: RunWindow = Query(default="all"),
    db: Session = Depends(get_db),
) -> SprintComparisonResponse:
    parsed_person_ids = _parse_person_ids(person_ids)
    return list_sprint_comparison(
        db=db,
        mode=mode,
        person_ids=parsed_person_ids,
        location=location,
        run_window=run_window,
    )


def _parse_person_ids(raw_person_ids: str) -> list[int]:
    values = [chunk.strip() for chunk in raw_person_ids.split(",")]
    if any(not value for value in values):
        raise HTTPException(status_code=422, detail="person_ids must be a comma-separated list of integers")

    try:
        parsed = [int(value) for value in values]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="person_ids must be a comma-separated list of integers") from exc

    if len(parsed) == 0:
        raise HTTPException(status_code=422, detail="person_ids must include at least one id")
    if len(parsed) > 4:
        raise HTTPException(status_code=422, detail="compare up to 4 people at once")

    return parsed
