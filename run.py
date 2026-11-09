"""Start PaperPal for local development.

    python run.py              # API (SQLite, in-process jobs) + web UI
    python run.py --api-only   # just the FastAPI backend
    python run.py --web-only   # just the Next.js frontend
    python run.py --docker     # full stack via Docker Compose

Requires uv and Node.js/npm on PATH (or Docker for --docker). Settings come from the root .env
(copied from .env.example on first run).
"""

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
WEB = ROOT / "apps" / "web"
COMPOSE_FILE = ROOT / "infra" / "compose.yaml"


def require(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        sys.exit(f"error: '{tool}' was not found on PATH")
    return path


def ensure_env_file() -> Path:
    env_file = ROOT / ".env"
    if not env_file.exists():
        shutil.copy(ROOT / ".env.example", env_file)
        print("Created .env from .env.example - add your GROQ_API_KEY and Supabase keys there.")
    return env_file


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.split(" #")[0].strip().strip("\"'")
        values[key.strip()] = value
    return values


def backend_command(host: str, port: int) -> list[str]:
    uv = require("uv")
    subprocess.run([uv, "sync"], cwd=BACKEND, check=True)
    return [uv, "run", "uvicorn", "paperpal.main:app", "--reload", "--host", host, "--port", str(port)]


def web_command(port: int) -> list[str]:
    npm = require("npm")
    if not (WEB / "node_modules").exists():
        subprocess.run([npm, "install"], cwd=WEB, check=True)
    return [npm, "run", "dev", "--", "--port", str(port)]


def run_docker() -> int:
    docker = require("docker")
    ensure_env_file()
    return subprocess.call([docker, "compose", "-f", str(COMPOSE_FILE), "--env-file", str(ROOT / ".env"), "up", "--build"], cwd=ROOT)


def stop(processes: list[subprocess.Popen]) -> None:
    for process in processes:
        if process.poll() is None:
            if os.name == "nt":
                # npm/uvicorn spawn child processes; kill the whole tree on Windows.
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        process.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run PaperPal locally.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--api-only", action="store_true", help="run only the backend API")
    group.add_argument("--web-only", action="store_true", help="run only the web frontend")
    group.add_argument("--docker", action="store_true", help="run the full stack with Docker Compose")
    parser.add_argument("--host", default="127.0.0.1", help="API host (default: 127.0.0.1)")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=3000)
    args = parser.parse_args()

    if args.docker:
        return run_docker()

    env = {**load_env_file(ensure_env_file()), **os.environ}
    env["USE_CELERY"] = "false"
    # Compose-style values in .env must not leak into a local run.
    if env.get("DATABASE_URL", "").startswith("postgresql"):
        env["DATABASE_URL"] = "sqlite+aiosqlite:///./paperpal.db"
    env["FRONTEND_ORIGIN"] = f"http://localhost:{args.web_port}"
    env["NEXT_PUBLIC_API_URL"] = f"http://localhost:{args.api_port}/api/v1"

    commands: list[tuple[str, list[str], Path]] = []
    if not args.web_only:
        commands.append(("api", backend_command(args.host, args.api_port), BACKEND))
    if not args.api_only:
        commands.append(("web", web_command(args.web_port), WEB))

    popen_kwargs = {} if os.name == "nt" else {"start_new_session": True}
    processes = [subprocess.Popen(cmd, cwd=cwd, env=env, **popen_kwargs) for _, cmd, cwd in commands]

    if not args.web_only:
        print(f"API:  http://localhost:{args.api_port}  (docs at /docs)")
    if not args.api_only:
        print(f"Web:  http://localhost:{args.web_port}")
    print("Press Ctrl+C to stop.")

    try:
        while all(p.poll() is None for p in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop(processes)

    exited = [(name, p.returncode) for (name, _, _), p in zip(commands, processes, strict=True) if p.returncode]
    return exited[0][1] if exited else 0


if __name__ == "__main__":
    sys.exit(main())
