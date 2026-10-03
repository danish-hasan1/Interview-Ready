"""Single entry point for any model call. Default: off (no network).
Backends: Ollama (local) and Groq (external, opt-in, key from the environment only)."""
import hashlib
import json
import os
import time
import urllib.request

import httpx

from . import config


class LLMUnavailable(Exception):
    """Raised for any provider failure. Messages never contain prompts, answers or keys."""


class LLMProvider:
    def complete(self, prompt: str, system: str = "", json_mode: bool = False) -> str:
        raise LLMUnavailable("LLM backend is off")


class OllamaProvider(LLMProvider):
    def complete(self, prompt: str, system: str = "", json_mode: bool = False) -> str:
        full = f"{system}\n\n{prompt}" if system else prompt
        body = json.dumps({"model": config.OLLAMA_MODEL, "prompt": full, "stream": False, **({"format": "json"} if json_mode else {})}).encode()
        req = urllib.request.Request(f"{config.OLLAMA_URL}/api/generate", body, {"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())["response"].strip()
        except Exception as e:
            raise LLMUnavailable("Local model unavailable") from e


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(LLMProvider):
    """OpenAI-compatible chat completions on Groq. The key is read at call time from the environment."""

    def __init__(self, model: str | None = None, transport: httpx.BaseTransport | None = None):
        self.model = model or os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
        self.transport = transport

    def complete(self, prompt: str, system: str = "", json_mode: bool = False) -> str:
        key = os.environ.get("GROQ_API_KEY", "")
        if not key:
            raise LLMUnavailable("Groq key not configured")
        messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
        payload = {"model": self.model, "messages": messages, "temperature": 0.2, "max_completion_tokens": 3000}
        if self.model.startswith("openai/gpt-oss"):
            payload["reasoning_effort"] = "low"  # reasoning tokens count against the limit; keep answers fast and cheap
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        last = "unknown"
        for attempt in range(3):
            try:
                with httpx.Client(timeout=45, transport=self.transport) as c:
                    r = c.post(GROQ_URL, json=payload, headers={"Authorization": f"Bearer {key}"})
            except httpx.HTTPError as e:
                last = type(e).__name__
                time.sleep(0.6 * (attempt + 1))
                continue
            if r.status_code == 200:
                try:
                    return r.json()["choices"][0]["message"]["content"].strip()
                except (KeyError, IndexError, ValueError) as e:
                    raise LLMUnavailable("Unexpected Groq response") from e
            if r.status_code in (429, 500, 502, 503) and attempt < 2:
                wait = float(r.headers.get("retry-after", 0) or 0)
                time.sleep(min(wait, 8) or 0.8 * (attempt + 1))
                last = str(r.status_code)
                continue
            if r.status_code in (401, 403):
                raise LLMUnavailable("Groq rejected the key")
            raise LLMUnavailable(f"Groq error {r.status_code}")
        raise LLMUnavailable(f"Groq unavailable ({last})")


class CachedProvider(LLMProvider):
    """Identical prompts hit the local cache instead of the model."""

    def __init__(self, inner: LLMProvider, cache):
        self.inner, self.cache = inner, cache

    def complete(self, prompt: str, system: str = "", json_mode: bool = False) -> str:
        key = hashlib.sha256(f"{system}|{json_mode}|{prompt}".encode()).hexdigest()
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        out = self.inner.complete(prompt, system, json_mode)
        self.cache.put(key, out)
        return out


def get_provider(cache=None) -> LLMProvider:
    backend = config.LLM_BACKEND
    if backend == "ollama":
        p = OllamaProvider()
    elif backend == "off":
        return LLMProvider()
    else:
        raise LLMUnavailable("Unsupported LLM backend")
    return CachedProvider(p, cache) if cache else p
