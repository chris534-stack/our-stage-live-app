"""Simple test to check Modal logs"""
import requests
import json

url = "https://christopher-ridgley--voxcpm-tts-fastapi-app.modal.run"

print("Testing synthesis with MAXIMUM QUALITY settings...")
payload = {
    "text": "Welcome to Our Stage Eugene. This is a high-quality test of the voice synthesis system with natural prosody.",
    "cfg_value": 1.8,  # Slightly more relaxed for natural sound
    "inference_timesteps": 25,  # Maximum quality
    "normalize": True,
    "denoise": True,
    "retry_badcase": True,  # Auto-retry if robotic
    "retry_badcase_max_times": 3,
    "retry_badcase_ratio_threshold": 6.0,
}

try:
    response = requests.post(
        f"{url}/synthesize",
        json=payload,
        timeout=180,  # 3 minute timeout
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        with open("generated_audio/test_output.wav", "wb") as f:
            f.write(response.content)
        print(f"✅ Success! Saved {len(response.content)} bytes to generated_audio/test_output.wav")
    else:
        print(f"❌ Error: {response.text}")
        
except requests.exceptions.Timeout:
    print("⏱️ Request timed out after 3 minutes")
    print("This likely means the model is still downloading (~500MB)")
    print("Try again in 1-2 minutes")
except Exception as e:
    print(f"❌ Error: {e}")
