from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_write_token
from database import get_db
from schemas import PeopleListQuery, PersonCreateRequest, PersonRow
from services.people import create_person, delete_person, list_people


router = APIRouter(prefix="/v1/people", tags=["people"])


@router.get("", response_model=list[PersonRow])
def list_people_route(
    query: PeopleListQuery = Depends(),
    db: Session = Depends(get_db),
) -> list[PersonRow]:
    return list_people(db=db, q=query.q, limit=query.limit)


@router.post("", response_model=PersonRow)
def create_person_route(
    payload: PersonCreateRequest,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> PersonRow:
    return create_person(db=db, payload=payload)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person_route(
    person_id: int,
    _auth: None = Depends(require_write_token),
    db: Session = Depends(get_db),
) -> Response:
    delete_person(db=db, person_id=person_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
