from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_admin_mutation
from core.errors import ValidationAppError
from database import get_db
from models import AdminSession
from schemas import (
    BestTimesQuery,
    BestTimesResponse,
    SprintComparisonQuery,
    SprintComparisonResponse,
    SprintCreateRequest,
    SprintListQuery,
    SprintListResponse,
    SprintRow,
    SprintUpdateRequest,
)
from services.sprints import (
    create_sprint_entry,
    delete_sprint_entry,
    list_best_times,
    list_sprint_comparison,
    list_sprints,
    update_sprint_entry,
)


router = APIRouter(prefix="/v1/sprints", tags=["sprints"])


@router.post("", response_model=SprintRow)
def create_sprint_entry_route(
    payload: SprintCreateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> SprintRow:
    return create_sprint_entry(db=db, payload=payload)


@router.patch("/{sprint_id}", response_model=SprintRow)
def update_sprint_entry_route(
    sprint_id: int,
    payload: SprintUpdateRequest,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> SprintRow:
    return update_sprint_entry(db=db, sprint_id=sprint_id, payload=payload)


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint_entry_route(
    sprint_id: int,
    _auth: AdminSession = Depends(require_admin_mutation),
    db: Session = Depends(get_db),
) -> Response:
    delete_sprint_entry(db=db, sprint_id=sprint_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=SprintListResponse)
def list_sprints_route(
    query: SprintListQuery = Depends(),
    db: Session = Depends(get_db),
) -> SprintListResponse:
    return list_sprints(
        db=db,
        limit=query.limit,
        offset=query.offset,
        sort_by=query.sort_by,
        sort_dir=query.sort_dir,
        name=query.name,
        name_filter_type=query.name_filter_type,
        location=query.location,
        location_filter_type=query.location_filter_type,
        date_from=query.date_from,
        date_to=query.date_to,
        date_not=query.date_not,
        min_time_ms=query.min_time_ms,
        max_time_ms=query.max_time_ms,
    )


@router.get("/best", response_model=BestTimesResponse)
def list_best_times_route(
    query: BestTimesQuery = Depends(),
    db: Session = Depends(get_db),
) -> BestTimesResponse:
    return list_best_times(
        db=db,
        limit=query.limit,
        offset=query.offset,
        sort_by=query.sort_by,
        sort_dir=query.sort_dir,
        name=query.name,
        name_filter_type=query.name_filter_type,
        location=query.location,
        location_filter_type=query.location_filter_type,
        date_from=query.date_from,
        date_to=query.date_to,
        date_not=query.date_not,
    )


@router.get("/comparison", response_model=SprintComparisonResponse)
def list_sprint_comparison_route(
    query: SprintComparisonQuery = Depends(),
    db: Session = Depends(get_db),
) -> SprintComparisonResponse:
    try:
        parsed_person_ids = query.parsed_person_ids()
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc

    return list_sprint_comparison(
        db=db,
        mode=query.mode,
        person_ids=parsed_person_ids,
        location=query.location,
        run_window=query.run_window,
    )
