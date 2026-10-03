import json
import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env_files():
    """Read .env.local then .env from the project root. Real environment variables win. No dependency needed."""
    for name in (".env.local", ".env"):
        f = ROOT / name
        if not f.is_file():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip("\"'")
            if k and v and k not in os.environ:
                os.environ[k] = v


_load_env_files()
PRESET_DIR = Path(__file__).resolve().parent / "presets"
DATA_DIR = Path(os.environ.get("INTERVIEW_READY_DATA", ROOT / "data"))
DB_PATH = DATA_DIR / "interview_ready.db"

# off (default) | ollama | external. External is never enabled implicitly.
LLM_BACKEND = os.environ.get("INTERVIEW_READY_LLM", "off").lower()
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")


@lru_cache(maxsize=None)
def preset(name: str) -> dict:
    with open(PRESET_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)

GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
# 0 = unlimited (owner's choice). Set AI_DAILY_CAP to bound spend.
AI_DAILY_CAP = int(os.environ.get("AI_DAILY_CAP", "0") or 0)
