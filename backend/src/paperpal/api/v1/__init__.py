from fastapi import APIRouter

from paperpal.api.v1 import auth, chat, jobs, papers, related

router = APIRouter()
for module in (auth, papers, jobs, chat, related):
    router.include_router(module.router)
