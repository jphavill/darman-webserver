from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.photos import router as photos_router
from api.routers.sprints import router as sprints_router
from api.routers.system import router as system_router


app = FastAPI(root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.jasonhavill.com",
        "http://localhost",
        "http://localhost:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(sprints_router)
app.include_router(photos_router)
