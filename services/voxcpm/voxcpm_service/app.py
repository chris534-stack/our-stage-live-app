from io import BytesIO
from functools import partial
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel
from voxcpm import VoxCPM


app = FastAPI(title="VoxCPM Service", version="0.1.0")


class SynthesisRequest(BaseModel):
    text: str
    prompt_wav_path: Optional[str] = None
    prompt_text: Optional[str] = None
    cfg_value: Optional[float] = 2.0
    inference_timesteps: Optional[int] = 10
    normalize: Optional[bool] = True
    denoise: Optional[bool] = True


MODEL_ID = "openbmb/VoxCPM-0.5B"
CACHE_DIR = Path("/app/.cache")

_vox_model: VoxCPM | None = None


def get_model() -> VoxCPM:
    global _vox_model
    if _vox_model is None:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _vox_model = VoxCPM.from_pretrained(MODEL_ID, cache_dir=str(CACHE_DIR))
    return _vox_model


@app.on_event("startup")
async def preload_model() -> None:
    # Lazily load at first request to avoid blocking cold start unnecessarily
    get_model()


@app.get("/health")
async def health() -> dict[str, str]:
    """Simple health check endpoint for uptime monitoring."""
    return {"status": "ok"}


@app.post("/synthesize")
async def synthesize(payload: SynthesisRequest) -> Response:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text input must not be empty.")

    model = get_model()

    generate_fn = partial(
        model.generate,
        text=text,
        prompt_wav_path=payload.prompt_wav_path,
        prompt_text=payload.prompt_text,
        cfg_value=payload.cfg_value,
        inference_timesteps=payload.inference_timesteps,
        normalize=payload.normalize,
        denoise=payload.denoise,
    )

    wav = await run_in_threadpool(generate_fn)

    audio_buffer = np.asarray(wav, dtype=np.float32)
    with BytesIO() as tmp_io:
        sf.write(tmp_io, audio_buffer, 16000, format="WAV")
        tmp_io.seek(0)
        audio_bytes = tmp_io.read()

    return Response(content=audio_bytes, media_type="audio/wav")
