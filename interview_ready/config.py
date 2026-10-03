import json
import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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
