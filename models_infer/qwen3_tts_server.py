"""
Qwen3-TTS Inference Server — OpenAI TTS-compatible API + SSE streaming.

REST endpoints:
  POST /v1/audio/speech  (JSON: model, input, voice, response_format, speed, stream, language, instruct)
  GET  /v1/models
  GET  /health

When stream=false (default): returns complete audio file.
When stream=true: returns SSE stream of per-sentence audio chunks.

Environment variables:
  QWEN3TTS_API_KEY     — API key (default: sk-qwen3tts-demo)
  QWEN3TTS_PORT        — listen port (default: 8002)
  QWEN3TTS_MODEL_DIR   — model path
  QWEN3TTS_DEVICE      — device (default: cuda:0)
  QWEN3TTS_DTYPE       — torch dtype (default: bfloat16)
  QWEN3TTS_SPEAKER     — default speaker (default: Vivian)
  QWEN3TTS_LANGUAGE    — default language (default: Chinese)
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from contextlib import asynccontextmanager

import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

API_KEY = os.getenv("QWEN3TTS_API_KEY", "sk-qwen3tts-demo")
PORT = int(os.getenv("QWEN3TTS_PORT", "8002"))
MODEL_DIR = os.getenv(
    "QWEN3TTS_MODEL_DIR",
    "/home/panxiandong/projects/models_dir/Qwen3-TTS-12Hz-1.7B-CustomVoice",
)
DEVICE = os.getenv("QWEN3TTS_DEVICE", "cuda:0")
DTYPE_STR = os.getenv("QWEN3TTS_DTYPE", "bfloat16")
DEFAULT_SPEAKER = os.getenv("QWEN3TTS_SPEAKER", "Vivian")
DEFAULT_LANGUAGE = os.getenv("QWEN3TTS_LANGUAGE", "Chinese")

DTYPE_MAP = {
    "float16": torch.float16,
    "bfloat16": torch.bfloat16,
    "float32": torch.float32,
}

model = None

# Sentence‑splitting pattern for Chinese / English / Japanese mixed text
SENTENCE_SPLIT = re.compile(r"(?<=[。！？.!?\n;；])")

RESPONSE_FORMAT_MAP: dict[str, str] = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "opus": "audio/opus",
    "aac": "audio/aac",
    "flac": "audio/flac",
}

# ── Model loading ─────────────────────────────────────────────────────────────


def load_model():
    from qwen_tts import Qwen3TTSModel

    global model
    dtype = DTYPE_MAP.get(DTYPE_STR, torch.bfloat16)
    model = Qwen3TTSModel.from_pretrained(
        MODEL_DIR,
        device_map=DEVICE,
        dtype=dtype,
        attn_implementation="sdpa",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Qwen3-TTS Inference Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────────


def verify_auth(authorization: str | None):
    if authorization is None:
        raise HTTPException(401, "Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != API_KEY:
        raise HTTPException(401, "Invalid API key")


# ── Audio generation helpers ──────────────────────────────────────────────────


def generate_audio(text: str, speaker: str, language: str, instruct: str) -> tuple[bytes, int]:
    """Run full TTS inference and return (WAV bytes, sample_rate)."""
    wavs, sr = model.generate_custom_voice(
        text=text,
        language=language,
        speaker=speaker,
        instruct=instruct,
    )
    buf = io.BytesIO()
    import soundfile as sf
    sf.write(buf, wavs[0], sr, format="WAV")
    return buf.getvalue(), sr


def split_sentences(text: str) -> list[str]:
    """Split text into sentence‑sized chunks for progressive generation.

    Returns a list of non‑empty strings.  Fragments that do not end with
    sentence‑ending punctuation are merged into the preceding chunk so that
    abbreviations (e.g. "Mr.") stay with their sentence.
    """
    parts = SENTENCE_SPLIT.split(text)
    parts = [p.strip() for p in parts if p.strip()]

    merged: list[str] = []
    for p in parts:
        if merged and not re.search(r"[。！？.!?\n;；]$", p):
            merged[-1] += p
        else:
            merged.append(p)
    return merged


def generate_audio_chunk(text: str, speaker: str, language: str, instruct: str) -> tuple[str, int]:
    """Generate audio for one sentence and return (base64‑encoded WAV, sample_rate)."""
    wav_bytes, sr = generate_audio(text, speaker, language, instruct)
    b64 = base64.b64encode(wav_bytes).decode("ascii")
    return b64, sr


# ── REST: Speech (non‑streaming) ──────────────────────────────────────────────

@app.post("/v1/audio/speech")
async def speech(request: Request):
    authorization = request.headers.get("authorization")
    verify_auth(authorization)

    body = await request.json()
    text = body.get("input")
    if not text:
        raise HTTPException(400, "Missing required field: input")

    voice = body.get("voice", DEFAULT_SPEAKER)
    language = body.get("language", DEFAULT_LANGUAGE)
    instruct = body.get("instruct", "")
    response_format = body.get("response_format", "wav")
    stream = body.get("stream", False)

    if response_format not in RESPONSE_FORMAT_MAP:
        raise HTTPException(400, f"Unsupported response_format: {response_format}")

    if stream:
        return _streaming_speech(text, voice, language, instruct, response_format)
    else:
        return _static_speech(text, voice, language, instruct, response_format)


def _static_speech(text: str, voice: str, language: str, instruct: str, fmt: str) -> Response:
    """Non‑streaming: generate full audio, return as complete file."""
    wav_bytes, sr = generate_audio(text, voice, language, instruct)

    if fmt == "wav":
        audio_bytes = wav_bytes
        media_type = RESPONSE_FORMAT_MAP[fmt]
    else:
        # Convert WAV → requested format via soundfile
        import soundfile as sf
        import numpy as np

        samples, sr = sf.read(io.BytesIO(wav_bytes))
        buf = io.BytesIO()
        sf.write(buf, samples, int(sr), format=fmt.upper())
        audio_bytes = buf.getvalue()
        media_type = RESPONSE_FORMAT_MAP[fmt]

    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="speech.{fmt}"'},
    )


# ── SSE streaming ─────────────────────────────────────────────────────────────


def _streaming_speech(text: str, voice: str, language: str, instruct: str, fmt: str) -> StreamingResponse:
    """Streaming: split into sentences, generate per‑sentence audio, emit SSE events."""

    sentences = split_sentences(text)
    if not sentences:
        sentences = [text]

    async def event_stream():
        for idx, sentence in enumerate(sentences):
            b64, sr = generate_audio_chunk(sentence, voice, language, instruct)
            payload = (
                f'data: {{"index":{idx},"text":{json.dumps(sentence)},'
                f'"sample_rate":{sr},"audio":"{b64}"}}\n\n'
            )
            yield payload

        yield 'data: {"index":-1,"text":"","sample_rate":0,"audio":""}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Utility endpoints ─────────────────────────────────────────────────────────


@app.get("/v1/models")
async def list_models(request: Request):
    authorization = request.headers.get("authorization")
    verify_auth(authorization)
    return {
        "object": "list",
        "data": [
            {
                "id": "qwen3-tts",
                "object": "model",
                "created": 0,
                "owned_by": "qwen",
            }
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
