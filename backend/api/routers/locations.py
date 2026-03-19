from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services.sprints import list_locations


router = APIRouter(prefix="/v1/locations", tags=["locations"])


@router.get("", response_model=list[str])
def list_locations_route(db: Session = Depends(get_db)) -> list[str]:
    return list_locations(db=db)
