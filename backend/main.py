from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers.locations import router as locations_router
from api.routers.people import router as people_router
from api.routers.photos import router as photos_router
from api.routers.sprints import router as sprints_router
from api.routers.system import router as system_router
from core.errors import AppError, TooManyRequestsAppError
from core.rate_limit import enforce_request_limit
from core.settings import get_settings


settings = get_settings()


app = FastAPI(root_path=settings.api_root_path)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return await call_next(request)

    try:
        enforce_request_limit(request)
    except TooManyRequestsAppError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return await call_next(request)


@app.exception_handler(AppError)
def handle_app_error(_, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(people_router)
app.include_router(locations_router)
app.include_router(sprints_router)
app.include_router(photos_router)
