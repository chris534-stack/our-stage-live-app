"""
Modal deployment configuration for VoxCPM TTS service.
Deploys the FastAPI app with T4 GPU for cost-effective inference.
"""

import modal

# Create Modal app
app = modal.App("voxcpm-tts")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "curl", "build-essential", "ffmpeg", "libsndfile1")
    .pip_install(
        "fastapi==0.115.2",
        "uvicorn[standard]==0.30.1",
        "numpy==1.26.4",
        "soundfile==0.12.1",
        "voxcpm==1.0.4",
        "huggingface_hub==0.24.7",
        "modelscope>=1.22.0",
    )
)

@app.function(
    image=image.env({"TORCH_COMPILE_DISABLE": "1", "TORCHDYNAMO_DISABLE": "1"}),
    gpu="T4",  # NVIDIA T4 GPU for cost-effective inference
    timeout=300,  # 5 minute timeout for long synthesis
    container_idle_timeout=300,  # Keep warm for 5 minutes to avoid cold starts
)
@modal.asgi_app()
def fastapi_app():
    """
    Serve the VoxCPM FastAPI application on Modal with GPU acceleration.
    """
    # Import dependencies inside the function so they're available in the container
    from io import BytesIO
    from functools import partial
    from pathlib import Path
    from typing import Optional
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    import os
    
    # Disable torch compilation BEFORE importing anything torch-related
    os.environ["TORCH_COMPILE_DISABLE"] = "1"
    import torch
    torch._dynamo.config.suppress_errors = True
    
    import numpy as np
    import soundfile as sf
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel
    from voxcpm import VoxCPM
    
    # Thread pool for running blocking operations
    executor = ThreadPoolExecutor(max_workers=1)
    
    app = FastAPI(title="VoxCPM Service", version="0.1.0")
    
    class SynthesisRequest(BaseModel):
        text: str
        prompt_wav_path: Optional[str] = None
        prompt_text: Optional[str] = None
        cfg_value: Optional[float] = 2.0
        inference_timesteps: Optional[int] = 15  # Default: balanced quality/cost
        normalize: Optional[bool] = True
        denoise: Optional[bool] = False  # Default off to save time
        retry_badcase: Optional[bool] = False  # Default off to save cost
        retry_badcase_max_times: Optional[int] = 3
        retry_badcase_ratio_threshold: Optional[float] = 6.0
    
    # Cache directory for model weights
    CACHE_DIR = Path("/app/.cache")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    MODEL_ID = "openbmb/VoxCPM-0.5B"
    
    # Use a mutable container to store the model cache (avoids global issues)
    model_cache = {"model": None}
    
    def get_model() -> VoxCPM:
        """Lazy-load the VoxCPM model (cached after first call)."""
        if model_cache["model"] is None:
            print(f"[VoxCPM] Initializing model {MODEL_ID}...")
            model_cache["model"] = VoxCPM.from_pretrained(MODEL_ID)
            print(f"[VoxCPM] Model initialized successfully")
        return model_cache["model"]
    
    @app.get("/health")
    def health():
        return {"status": "ok"}
    
    @app.post("/synthesize")
    async def synthesize(payload: SynthesisRequest) -> Response:
        try:
            text = payload.text.strip()
            if not text:
                raise HTTPException(status_code=400, detail="Text input must not be empty.")
            
            print(f"[VoxCPM] Loading model...")
            model = get_model()
            print(f"[VoxCPM] Model loaded, generating audio for: {text[:50]}...")
            
            generate_fn = partial(
                model.generate,
                text=text,
                prompt_wav_path=payload.prompt_wav_path,
                prompt_text=payload.prompt_text,
                cfg_value=payload.cfg_value,
                inference_timesteps=payload.inference_timesteps,
                normalize=payload.normalize,
                denoise=payload.denoise,
                retry_badcase=payload.retry_badcase,
                retry_badcase_max_times=payload.retry_badcase_max_times,
                retry_badcase_ratio_threshold=payload.retry_badcase_ratio_threshold,
            )
            
            # Run the blocking VoxCPM generation in a thread pool
            print(f"[VoxCPM] Starting generation...")
            loop = asyncio.get_event_loop()
            wav = await loop.run_in_executor(executor, generate_fn)
            print(f"[VoxCPM] Generation complete, encoding audio...")
            
            audio_buffer = np.asarray(wav, dtype=np.float32)
            with BytesIO() as tmp_io:
                sf.write(tmp_io, audio_buffer, 16000, format="WAV")
                tmp_io.seek(0)
                audio_bytes = tmp_io.read()
            
            print(f"[VoxCPM] Success! Generated {len(audio_bytes)} bytes")
            return Response(content=audio_bytes, media_type="audio/wav")
            
        except Exception as e:
            print(f"[VoxCPM] ERROR: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")
    
    return app


@app.local_entrypoint()
def main():
    """
    Test the deployed endpoint locally.
    """
    import requests
    
    # Get the deployed URL
    print("Testing VoxCPM Modal deployment...")
    
    # Health check
    health_response = requests.get(f"{fastapi_app.web_url}/health")
    print(f"Health check: {health_response.json()}")
    
    # Test synthesis
    test_payload = {
        "text": "Welcome to Our Stage Eugene. This is a test of the voice synthesis system.",
        "cfg_value": 1.5,
        "inference_timesteps": 10,
    }
    
    print("Sending synthesis request...")
    synth_response = requests.post(
        f"{fastapi_app.web_url}/synthesize",
        json=test_payload,
        timeout=60,
    )
    
    if synth_response.status_code == 200:
        with open("modal_test_output.wav", "wb") as f:
            f.write(synth_response.content)
        print(f"✓ Synthesis successful! Audio saved to modal_test_output.wav ({len(synth_response.content)} bytes)")
    else:
        print(f"✗ Synthesis failed: {synth_response.status_code} - {synth_response.text}")
