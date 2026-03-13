from fastapi import APIRouter


router = APIRouter()


@router.get("/")
def read_root() -> dict[str, str]:
    return {"message": "API is running"}


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
