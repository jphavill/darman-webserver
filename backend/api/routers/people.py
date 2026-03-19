from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas import PersonRow
from services.people import list_people


router = APIRouter(prefix="/v1/people", tags=["people"])


@router.get("", response_model=list[PersonRow])
def list_people_route(
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[PersonRow]:
    return list_people(db=db, q=q, limit=limit)
