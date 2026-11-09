import logging


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S")
    # Chroma's telemetry and HTTP client logs are noisy and not useful locally.
    for name in ("chromadb.telemetry", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)
