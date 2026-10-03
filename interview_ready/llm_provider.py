"""Single entry point for any model call. Default: off (no network)."""
import hashlib
import json
import urllib.request

from . import config


class LLMUnavailable(Exception):
    pass


class LLMProvider:
    def complete(self, prompt: str) -> str:
        raise LLMUnavailable("LLM backend is off")


class OllamaProvider(LLMProvider):
    def complete(self, prompt: str) -> str:
        body = json.dumps({"model": config.OLLAMA_MODEL, "prompt": prompt, "stream": False}).encode()
        req = urllib.request.Request(f"{config.OLLAMA_URL}/api/generate", body, {"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())["response"].strip()
        except Exception as e:  # network/model missing
            raise LLMUnavailable(str(e)) from e


class CachedProvider(LLMProvider):
    """Identical prompts hit the local cache instead of the model."""

    def __init__(self, inner: LLMProvider, cache):
        self.inner, self.cache = inner, cache

    def complete(self, prompt: str) -> str:
        key = hashlib.sha256(prompt.encode()).hexdigest()
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        out = self.inner.complete(prompt)
        self.cache.put(key, out)
        return out


def get_provider(cache=None) -> LLMProvider:
    backend = config.LLM_BACKEND
    if backend == "ollama":
        p = OllamaProvider()
    elif backend == "off":
        return LLMProvider()
    else:
        raise LLMUnavailable("External LLM not implemented in V1")
    return CachedProvider(p, cache) if cache else p
