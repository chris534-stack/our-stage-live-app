"""
Test voice consistency and long-form generation.
Demonstrates how to maintain character voices across multiple lines.
"""
import requests
import time

url = "https://christopher-ridgley--voxcpm-tts-fastapi-app.modal.run"

print("=" * 60)
print("VOICE CONSISTENCY & LONG-FORM TEST")
print("=" * 60)

# Step 1: Generate a voice prompt for "Hamlet"
print("\n📝 Step 1: Generating voice prompt for Hamlet...")
hamlet_prompt_text = "Hello, I am Hamlet, Prince of Denmark."

response = requests.post(
    f"{url}/synthesize",
    json={
        "text": hamlet_prompt_text,
        "cfg_value": 2.0,
        "inference_timesteps": 20,
    },
    timeout=60,
)

if response.status_code == 200:
    with open("generated_audio/hamlet_voice_prompt.wav", "wb") as f:
        f.write(response.content)
    print("✅ Voice prompt saved: generated_audio/hamlet_voice_prompt.wav")
    print("   (This would be uploaded to Cloud Storage and reused)")
else:
    print(f"❌ Failed: {response.status_code}")
    exit(1)

# Step 2: Generate multiple lines using the same voice prompt
print("\n📝 Step 2: Generating 3 different Hamlet lines with same voice...")

hamlet_lines = [
    "To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.",
    
    "O, that this too too solid flesh would melt, thaw and resolve itself into a dew! Or that the Everlasting had not fixed his canon against self-slaughter!",
    
    "The time is out of joint. O cursed spite, that ever I was born to set it right!"
]

for i, line in enumerate(hamlet_lines, 1):
    print(f"\n[{i}/3] Generating: '{line[:60]}...'")
    
    # NOTE: In production, you'd upload hamlet_voice_prompt.wav to Cloud Storage
    # and pass the URL here. For this test, we're just demonstrating the concept.
    response = requests.post(
        f"{url}/synthesize",
        json={
            "text": line,
            # prompt_wav_path: "gs://bucket/hamlet_voice_prompt.wav",  # In production
            # prompt_text: hamlet_prompt_text,
            "cfg_value": 2.0,
            "inference_timesteps": 15,
        },
        timeout=60,
    )
    
    if response.status_code == 200:
        filename = f"generated_audio/hamlet_line_{i}.wav"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"  ✅ Saved: {filename} ({len(response.content):,} bytes)")
    else:
        print(f"  ❌ Failed: {response.status_code}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
print("\n📁 Generated files in generated_audio/:")
print("  1. hamlet_voice_prompt.wav (reference voice)")
print("  2. hamlet_line_1.wav")
print("  3. hamlet_line_2.wav")
print("  4. hamlet_line_3.wav")
print("\n🎧 Listen to all 3 lines:")
print("  - WITHOUT voice prompt: Each line sounds different (random voices)")
print("  - WITH voice prompt: All lines sound like the same person")
print("\n💡 Next step: Upload hamlet_voice_prompt.wav to Cloud Storage")
print("   and use prompt_wav_path parameter for consistency.")
