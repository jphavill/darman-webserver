from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_write_token
from database import get_db
from schemas import PersonRow
from services.people import delete_person, list_people


router = APIRouter(prefix="/v1/people", tags=["people"])


@router.get("", response_model=list[PersonRow])
def list_people_route(
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[PersonRow]:
    return list_people(db=db, q=q, limit=limit)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person_route(
    person_id: int,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> Response:
    delete_person(db=db, person_id=person_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
