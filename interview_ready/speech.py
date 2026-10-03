"""Voice answers: local Whisper only. Audio is processed in memory and never stored."""
import io
import re

from .config import preset

_FILLERS = None


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


_model = None


def transcribe(audio: bytes) -> list:
    """Return [{word,start,end}] using a local faster-whisper model."""
    global _model
    from faster_whisper import WhisperModel

    if _model is None:
        _model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    segments, _ = _model.transcribe(io.BytesIO(audio), word_timestamps=True, vad_filter=True, language="en")
    return [{"word": w.word.strip(), "start": w.start, "end": w.end} for seg in segments for w in seg.words]


def speech_metrics(words: list, pause_s: float = 1.2) -> dict:
    """Pace, pauses and filler words from word timestamps."""
    if not words:
        return {"words": 0, "duration": 0, "wpm": 0, "pauses": [], "pause_count": 0, "longest_pause": 0, "fillers": {}, "filler_rate": 0}
    fillers_list = preset("scoring")["fillers"]
    duration = max(0.01, words[-1]["end"] - words[0]["start"])
    pauses = []
    for a, b in zip(words, words[1:]):
        gap = b["start"] - a["end"]
        if gap >= pause_s:
            pauses.append({"at": round(a["end"], 1), "length": round(gap, 1)})
    text = " ".join(w["word"].lower() for w in words)
    text = re.sub(r"\bu\s?\.?\s?m\b\.?", "um", text)  # Whisper often renders "um" as "U.M."
    fillers = {}
    for f in fillers_list:
        n = len(re.findall(rf"(?<!\w){re.escape(f)}(?!\w)", text))
        if n:
            fillers[f] = n
    spoken = max(1, len(words))
    return {
        "words": len(words), "duration": round(duration, 1), "wpm": round(len(words) / duration * 60),
        "pauses": pauses, "pause_count": len(pauses), "longest_pause": max((p["length"] for p in pauses), default=0),
        "fillers": fillers, "filler_rate": round(sum(fillers.values()) / spoken * 100, 1),
    }


def coaching(m: dict) -> list:
    out = []
    if m["wpm"] > 175:
        out.append(f"{m['wpm']} words a minute is fast. Aim for 130 to 160 and pause between points.")
    elif 0 < m["wpm"] < 110:
        out.append(f"{m['wpm']} words a minute is slow. Tighten your headline and move faster through context.")
    if m["pause_count"] >= 3:
        out.append(f"{m['pause_count']} long pauses (longest {m['longest_pause']}s). Structure the answer before you speak.")
    if m["filler_rate"] >= 3:
        out.append("Filler words: " + ", ".join(f'"{k}" x{v}' for k, v in list(m["fillers"].items())[:4]) + ". Replace them with a pause.")
    return out or ["Pace and delivery are in a good range."]
