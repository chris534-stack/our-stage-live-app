"""
Test batch processing to reduce costs.
Generate multiple lines in one session to avoid cold starts.
"""
import requests
import time

url = "https://christopher-ridgley--voxcpm-tts-fastapi-app.modal.run"

# Optimized settings for cost
COST_OPTIMIZED_SETTINGS = {
    "cfg_value": 2.0,
    "inference_timesteps": 15,  # Reduced from 25 (40% faster)
    "normalize": True,
    "denoise": False,  # Disabled to save time
    "retry_badcase": False,  # Disabled to avoid retries
}

# Test lines (simulating a small script)
test_lines = [
    "To be, or not to be, that is the question.",
    "Whether 'tis nobler in the mind to suffer.",
    "The slings and arrows of outrageous fortune.",
    "Or to take arms against a sea of troubles.",
    "And by opposing, end them.",
]

print("=" * 60)
print("BATCH PROCESSING TEST - Cost Optimization")
print("=" * 60)
print(f"\nSettings:")
print(f"  - inference_timesteps: {COST_OPTIMIZED_SETTINGS['inference_timesteps']}")
print(f"  - retry_badcase: {COST_OPTIMIZED_SETTINGS['retry_badcase']}")
print(f"  - denoise: {COST_OPTIMIZED_SETTINGS['denoise']}")
print(f"\nGenerating {len(test_lines)} lines in batch...\n")

start_time = time.time()
total_bytes = 0

for i, line in enumerate(test_lines, 1):
    print(f"[{i}/{len(test_lines)}] Generating: '{line[:50]}...'")
    
    payload = {
        "text": line,
        **COST_OPTIMIZED_SETTINGS
    }
    
    try:
        line_start = time.time()
        response = requests.post(
            f"{url}/synthesize",
            json=payload,
            timeout=60,
        )
        line_duration = time.time() - line_start
        
        if response.status_code == 200:
            audio_bytes = len(response.content)
            total_bytes += audio_bytes
            
            # Save audio file
            filename = f"generated_audio/batch_output_{i}.wav"
            with open(filename, "wb") as f:
                f.write(response.content)
            
            print(f"  ✅ Success! {audio_bytes:,} bytes in {line_duration:.1f}s → {filename}")
        else:
            print(f"  ❌ Failed: {response.status_code}")
            
    except Exception as e:
        print(f"  ❌ Error: {e}")

total_duration = time.time() - start_time

print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)
print(f"Total lines: {len(test_lines)}")
print(f"Total time: {total_duration:.1f}s")
print(f"Avg time/line: {total_duration/len(test_lines):.1f}s")
print(f"Total audio: {total_bytes:,} bytes")
print(f"\nEstimated cost:")
print(f"  - GPU time: {total_duration:.0f}s × $0.000164/s = ${total_duration * 0.000164:.4f}")
print(f"  - Per line: ${(total_duration * 0.000164) / len(test_lines):.4f}")
print(f"\nProjected script cost (150 lines):")
print(f"  - ${((total_duration * 0.000164) / len(test_lines)) * 150:.2f}")
