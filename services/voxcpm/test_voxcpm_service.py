"""Smoke test for the VoxCPM FastAPI service and model download."""

from pathlib import Path

from fastapi.testclient import TestClient

from voxcpm_service.app import CACHE_DIR, MODEL_ID, app


def main() -> None:
    client = TestClient(app)

    print("--- /health")
    health = client.get("/health")
    health.raise_for_status()
    print(health.json())

    print("--- /synthesize")
    response = client.post(
        "/synthesize",
        json={
            "text": "Testing VoxCPM end-to-end from the Our Stage service.",
            "inference_timesteps": 4,
            "cfg_value": 1.5,
        },
        timeout=None,
    )
    response.raise_for_status()
    out_path = Path("output_test.wav")
    out_path.write_bytes(response.content)
    print(f"Audio saved to {out_path.resolve()} ({out_path.stat().st_size} bytes)")

    cache_items = list(CACHE_DIR.glob("**/*"))[:10]
    print(f"Model cache directory: {CACHE_DIR}")
    print(f"Model ID: {MODEL_ID}")
    print("Cache sample:")
    for entry in cache_items:
        print(f"  - {entry.relative_to(CACHE_DIR)}")

if __name__ == "__main__":
    main()
