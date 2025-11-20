"""Get detailed error from Modal"""
import requests

url = "https://christopher-ridgley--voxcpm-tts-fastapi-app.modal.run"

print("Testing with detailed error...")
response = requests.post(
    f"{url}/synthesize",
    json={"text": "Test", "cfg_value": 1.5, "inference_timesteps": 5},
    timeout=60,
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
