"""
Fun-ASR Inference Server — OpenAI Whisper-compatible API + WebSocket streaming.

REST endpoints:
  POST /v1/audio/transcriptions  (multipart: file + model + optional language)
  GET  /v1/models
  GET  /health

WebSocket endpoint:
  ws /v1/audio/transcriptions/stream?api_key=<key>
    Client → Server: binary PCM frames (16 kHz, 16-bit, mono)
    Server → Client: JSON messages {type, text, ...}

Environment variables:
  FUNASR_API_KEY     — API key for Bearer auth (default: sk-funasr-demo)
  FUNASR_PORT        — listen port (default: 8001)
  FUNASR_MODEL_DIR   — model path
  FUNASR_DEVICE      — device (default: cuda:0)
  FUNASR_LANGUAGE    — default recognition language (default: 中文)
"""

from __future__ import annotations

import os
import tempfile
import webrtcvad
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

API_KEY = os.getenv("FUNASR_API_KEY", "sk-funasr-demo")
PORT = int(os.getenv("FUNASR_PORT", "8001"))
MODEL_DIR = os.getenv(
    "FUNASR_MODEL_DIR",
    "/home/panxiandong/projects/models_dir/Fun-ASR-Nano-2512",
)
DEVICE = os.getenv("FUNASR_DEVICE", "cuda:0")
LANGUAGE = os.getenv("FUNASR_LANGUAGE", "中文")

# WebRTC VAD: 30 ms frames at 16 kHz → 480 samples → 960 bytes (16-bit PCM)
VAD_FRAME_MS = 30
VAD_FRAME_SIZE = 480  # 16 kHz × 0.030 s
VAD_FRAME_BYTES = VAD_FRAME_SIZE * 2  # 16-bit
SPEECH_THRESHOLD = 3  # consecutive speech frames to trigger speech start
SILENCE_THRESHOLD = 15  # consecutive silence frames to trigger speech end

model = None


def load_model():
    from funasr import AutoModel

    global model
    model = AutoModel(
        model=MODEL_DIR,
        trust_remote_code=True,
        remote_code="./model.py",
        device=DEVICE,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Fun-ASR Inference Server", lifespan=lifespan)

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


# ── REST: Transcriptions ──────────────────────────────────────────────────────

@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile = File(...),
    model_name: str = Form("funasr-nano"),
    language: str = Form(LANGUAGE),
    authorization: str | None = Header(None),
):
    verify_auth(authorization)

    suffix = ".wav"
    if file.filename:
        _, ext = os.path.splitext(file.filename)
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        res = model.generate(
            input=[tmp_path],
            cache={},
            batch_size=1,
            language=language,
            itn=True,
        )
        text = res[0]["text"]
        return JSONResponse({"text": text})
    finally:
        os.unlink(tmp_path)


# ── WebSocket: Streaming ASR ──────────────────────────────────────────────────

@app.websocket("/v1/audio/transcriptions/stream")
async def asr_stream(websocket: WebSocket):
    await websocket.accept()

    # Auth
    api_key = websocket.query_params.get("api_key")
    if api_key != API_KEY:
        await websocket.send_json({"type": "error", "message": "Invalid API key"})
        await websocket.close(code=4001)
        return

    vad = webrtcvad.Vad(2)  # aggressiveness: 0–3 (2 = reasonable)
    buf = b""
    speech_buf = bytearray()
    silence_cnt = 0
    speech_cnt = 0
    speaking = False

    def process_speech(audio_bytes: bytes) -> str | None:
        if not audio_bytes.strip(b"\x00"):
            return None
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            import soundfile as sf
            import numpy as np

            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            sf.write(tmp.name, samples, 16000)
            tmp_path = tmp.name

        try:
            res = model.generate(
                input=[tmp_path],
                cache={},
                batch_size=1,
                language=LANGUAGE,
                itn=True,
            )
            return res[0]["text"]
        finally:
            os.unlink(tmp_path)

    try:
        while True:
            data = await websocket.receive_bytes()
            buf += data

            # Process one VAD frame at a time
            while len(buf) >= VAD_FRAME_BYTES:
                frame = buf[:VAD_FRAME_BYTES]
                buf = buf[VAD_FRAME_BYTES:]

                is_speech = vad.is_speech(frame, 16000)

                if is_speech:
                    speech_cnt += 1
                    silence_cnt = 0

                    if not speaking and speech_cnt >= SPEECH_THRESHOLD:
                        speaking = True
                        speech_buf = bytearray(frame)
                        await websocket.send_json({"type": "speech_started"})
                    elif speaking:
                        speech_buf.extend(frame)
                else:
                    silence_cnt += 1
                    speech_cnt = 0

                    if speaking:
                        speech_buf.extend(frame)
                        if silence_cnt >= SILENCE_THRESHOLD:
                            # End of speech segment
                            speaking = False
                            text = process_speech(bytes(speech_buf))
                            if text and text.strip():
                                await websocket.send_json({
                                    "type": "final",
                                    "text": text.strip(),
                                })
                            speech_buf = bytearray()
                            silence_cnt = 0

    except WebSocketDisconnect:
        # Process any remaining speech
        if speaking and len(speech_buf) > VAD_FRAME_BYTES * 2:
            text = process_speech(bytes(speech_buf))
            if text and text.strip():
                import asyncio
                try:
                    await websocket.send_json({
                        "type": "final",
                        "text": text.strip(),
                    })
                except Exception:
                    pass


# ── Utility endpoints ─────────────────────────────────────────────────────────

@app.get("/v1/models")
async def list_models(authorization: str | None = Header(None)):
    verify_auth(authorization)
    return {
        "object": "list",
        "data": [
            {
                "id": "funasr-nano",
                "object": "model",
                "created": 0,
                "owned_by": "funasr",
            }
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
