"""Durable Celery entrypoint used in Compose and production deployments."""
import asyncio

from celery import Celery

from paperpal.core.config import get_settings

celery_app = Celery("paperpal", broker=get_settings().redis_url)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_time_limit=900,
    task_soft_time_limit=840,
)


@celery_app.task(bind=True, max_retries=2, autoretry_for=(Exception,), retry_backoff=True)
def process_pdf(self, paper_id: str, job_id: str):
    from paperpal.services.ingestion_service import process_paper

    asyncio.run(process_paper(paper_id, job_id))
