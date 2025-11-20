"""
Generate a voice library for theatrical character archetypes.
Uses VoxCPM's zero-shot generation to create consistent character voices.
"""
import requests
import time

url = "https://christopher-ridgley--voxcpm-tts-fastapi-app.modal.run"

# Theatrical character archetypes with voice-guiding prompts
VOICE_LIBRARY = {
    "young_female_ingenue": {
        "description": "Young female ingenue (18-25, bright, optimistic)",
        "prompt_text": "Hello, I'm a young woman full of hope and dreams. My voice is bright and energetic, with a youthful enthusiasm that lights up every room I enter.",
        "tags": ["female", "young", "ingenue", "romantic", "optimistic"]
    },
    
    "young_male_hero": {
        "description": "Young male hero (20-30, confident, earnest)",
        "prompt_text": "Hello, I'm a young man ready to face any challenge. My voice is strong and confident, with an earnest quality that inspires trust and courage.",
        "tags": ["male", "young", "hero", "romantic", "confident"]
    },
    
    "mature_female_authority": {
        "description": "Mature female authority (40-60, wise, commanding)",
        "prompt_text": "Hello, I am a woman of experience and wisdom. My voice carries authority and grace, earned through years of navigating life's complexities.",
        "tags": ["female", "mature", "authority", "wise", "commanding"]
    },
    
    "mature_male_authority": {
        "description": "Mature male authority (45-65, authoritative, gravitas)",
        "prompt_text": "Hello, I am a man who commands respect. My voice has depth and gravitas, speaking with the weight of experience and authority.",
        "tags": ["male", "mature", "authority", "father", "mentor"]
    },
    
    "comedic_relief_male": {
        "description": "Comedic relief male (any age, energetic, quirky)",
        "prompt_text": "Hey there! I'm the guy who keeps things light and fun. My voice is animated and playful, always ready with a joke or a funny observation.",
        "tags": ["male", "comedic", "quirky", "energetic", "sidekick"]
    },
    
    "comedic_relief_female": {
        "description": "Comedic relief female (any age, witty, sarcastic)",
        "prompt_text": "Oh hi! I'm the one with all the witty comebacks. My voice is sharp and sarcastic, delivering zingers with perfect comedic timing.",
        "tags": ["female", "comedic", "witty", "sarcastic", "sidekick"]
    },
    
    "villain_male": {
        "description": "Villain male (30-60, menacing, smooth)",
        "prompt_text": "Greetings. I am a man who gets what he wants, by any means necessary. My voice is smooth yet menacing, with an undercurrent of danger.",
        "tags": ["male", "villain", "antagonist", "menacing", "smooth"]
    },
    
    "villain_female": {
        "description": "Villain female (30-60, cunning, seductive)",
        "prompt_text": "Hello darling. I am a woman who knows how to manipulate and control. My voice is seductive yet cold, hiding sharp intelligence and ruthless ambition.",
        "tags": ["female", "villain", "antagonist", "cunning", "seductive"]
    },
    
    "elderly_male_wise": {
        "description": "Elderly male wise figure (65+, gentle, weathered)",
        "prompt_text": "Hello my dear. I am an old man who has seen much in this world. My voice is gentle and weathered, carrying the wisdom of many years.",
        "tags": ["male", "elderly", "wise", "mentor", "grandfather"]
    },
    
    "elderly_female_wise": {
        "description": "Elderly female wise figure (65+, warm, knowing)",
        "prompt_text": "Hello child. I am an old woman who understands the ways of the world. My voice is warm and knowing, offering comfort and ancient wisdom.",
        "tags": ["female", "elderly", "wise", "mentor", "grandmother"]
    },
    
    "child_male": {
        "description": "Child male (8-12, innocent, curious)",
        "prompt_text": "Hi! I'm just a kid trying to figure things out. My voice is young and curious, full of innocent wonder about the world.",
        "tags": ["male", "child", "innocent", "curious", "young"]
    },
    
    "child_female": {
        "description": "Child female (8-12, sweet, precocious)",
        "prompt_text": "Hello! I'm a smart kid who notices everything. My voice is sweet but precocious, showing wisdom beyond my years.",
        "tags": ["female", "child", "innocent", "precocious", "young"]
    },
}

print("=" * 70)
print("GENERATING THEATRICAL VOICE LIBRARY")
print("=" * 70)
print(f"\nGenerating {len(VOICE_LIBRARY)} character archetypes...")
print("This will take ~5 minutes and cost ~$0.15\n")

results = []
total_cost = 0

for voice_id, voice_data in VOICE_LIBRARY.items():
    print(f"\n📝 Generating: {voice_data['description']}")
    print(f"   Prompt: \"{voice_data['prompt_text'][:60]}...\"")
    
    try:
        start_time = time.time()
        
        response = requests.post(
            f"{url}/synthesize",
            json={
                "text": voice_data["prompt_text"],
                "cfg_value": 1.8,  # Slightly relaxed for natural expressiveness
                "inference_timesteps": 25,  # Maximum quality
                "normalize": True,
                "denoise": True,
                "retry_badcase": True,  # Auto-retry if robotic
                "retry_badcase_max_times": 3,
            },
            timeout=120,  # Longer timeout for retries
        )
        
        duration = time.time() - start_time
        cost = duration * 0.000164  # T4 GPU cost
        total_cost += cost
        
        if response.status_code == 200:
            filename = f"generated_audio/voice_library_{voice_id}.wav"
            with open(filename, "wb") as f:
                f.write(response.content)
            
            print(f"   ✅ Success! Saved to {filename}")
            print(f"   📊 {len(response.content):,} bytes | {duration:.1f}s | ${cost:.4f}")
            
            results.append({
                "voice_id": voice_id,
                "filename": filename,
                "description": voice_data["description"],
                "prompt_text": voice_data["prompt_text"],
                "tags": voice_data["tags"],
                "file_size": len(response.content),
                "cost": cost,
            })
        else:
            print(f"   ❌ Failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

print("\n" + "=" * 70)
print("VOICE LIBRARY GENERATION COMPLETE")
print("=" * 70)
print(f"\n✅ Generated {len(results)}/{len(VOICE_LIBRARY)} voices")
print(f"💰 Total cost: ${total_cost:.4f}")
print(f"\n📁 Files saved to: generated_audio/voice_library_*.wav")

print("\n" + "=" * 70)
print("VOICE LIBRARY CATALOG")
print("=" * 70)

for result in results:
    print(f"\n🎭 {result['voice_id']}")
    print(f"   Description: {result['description']}")
    print(f"   Tags: {', '.join(result['tags'])}")
    print(f"   File: {result['filename']}")
    print(f"   Size: {result['file_size']:,} bytes")

print("\n" + "=" * 70)
print("NEXT STEPS")
print("=" * 70)
print("\n1. Listen to each voice and verify quality")
print("2. Upload to Cloud Storage (Firebase Storage)")
print("3. Store metadata in Firestore:")
print("   Collection: voiceLibrary")
print("   Documents: Each voice with tags and storage URL")
print("\n4. Character matching algorithm:")
print("   - Parse character name/description from script")
print("   - Match tags (gender, age, archetype)")
print("   - Assign voice from library")
print("   - Ensure no duplicate voices in same show")
