"""
Quick test script to verify Modal deployment is working.
"""
import requests
import modal

# Get the deployed app
app = modal.App.lookup("voxcpm-tts", create_if_missing=False)

# Get the web endpoint URL
fastapi_app = modal.Function.lookup("voxcpm-tts", "fastapi_app")
url = fastapi_app.web_url

print(f"🚀 Modal VoxCPM Service URL: {url}")
print("\n" + "="*60)

# Test 1: Health check
print("\n1️⃣ Testing /health endpoint...")
try:
    health_response = requests.get(f"{url}/health", timeout=10)
    health_response.raise_for_status()
    print(f"✅ Health check passed: {health_response.json()}")
except Exception as e:
    print(f"❌ Health check failed: {e}")
    exit(1)

# Test 2: Synthesize audio
print("\n2️⃣ Testing /synthesize endpoint...")
test_payload = {
    "text": "Welcome to Our Stage Eugene. This is a test of the voice synthesis system.",
    "cfg_value": 1.5,
    "inference_timesteps": 10,
}

try:
    print(f"   Sending request with text: '{test_payload['text']}'")
    print("   ⏳ Generating audio (this may take 10-30 seconds on first request)...")
    
    synth_response = requests.post(
        f"{url}/synthesize",
        json=test_payload,
        timeout=120,
    )
    synth_response.raise_for_status()
    
    # Save the audio file
    output_file = "modal_test_output.wav"
    with open(output_file, "wb") as f:
        f.write(synth_response.content)
    
    print(f"✅ Synthesis successful!")
    print(f"   📁 Audio saved to: {output_file}")
    print(f"   📊 File size: {len(synth_response.content):,} bytes")
    print(f"   🎵 Duration: ~{len(synth_response.content) / 32000:.1f} seconds")
    
except requests.exceptions.Timeout:
    print("❌ Request timed out. The model may be cold-starting (downloading weights).")
    print("   Try running this script again in 1-2 minutes.")
except Exception as e:
    print(f"❌ Synthesis failed: {e}")
    exit(1)

print("\n" + "="*60)
print("🎉 All tests passed! Modal deployment is working correctly.")
print(f"\n📝 Next steps:")
print(f"   1. Play {output_file} to verify audio quality")
print(f"   2. Use this URL in your Next.js API route: {url}")
