from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .deps import warm_services
from .settings import settings
from .routers import benchmark as benchmark_router
from .routers import corpus as corpus_router
from .routers import health as health_router
from .routers import kg as kg_router
from .routers import results as results_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    warm_services()
    yield


app = FastAPI(
    title="AKN-RLM API",
    description="Citation-faithful Algerian legal QA - viva demo backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router.router, prefix="/api")
app.include_router(corpus_router.router, prefix="/api")
app.include_router(benchmark_router.router, prefix="/api")
app.include_router(results_router.router, prefix="/api")
app.include_router(kg_router.router, prefix="/api")
