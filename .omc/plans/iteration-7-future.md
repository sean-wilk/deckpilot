# DeckPilot — Voice & Image Capabilities (Future Roadmap)

> Research note from Iteration 7 TanStack AI migration. Not yet implemented.

## TanStack AI Voice/Image API Surface

Now that DeckPilot uses TanStack AI, the following capabilities are available:

### Voice (Realtime)
- `realtimeToken()` — generates ephemeral tokens for client-side WebRTC voice sessions
- `openaiRealtimeToken()` — OpenAI-specific adapter for realtime voice
- Enables: "Talk to your deck" — voice-based deck analysis and card discussions
- Requires: OpenAI realtime API access (additional cost)

### Image Generation
- `generateImage()` from `@tanstack/ai`
- `openaiImage()` adapter from `@tanstack/ai-openai`
- Potential uses: Custom deck art generation, card alter previews

### Speech-to-Text (Transcription)
- `generateTranscription()` from `@tanstack/ai`
- Potential uses: Voice notes on cards, dictate deck philosophy

### Text-to-Speech
- `generateSpeech()` from `@tanstack/ai`
- `openaiSpeech()` adapter
- Potential uses: Read analysis results aloud, accessibility

## Proposed Features

### 1. Voice Deck Assistant
- User can ask questions about their deck via voice
- AI responds with analysis, card suggestions
- Uses WebRTC realtime for low-latency conversation
- Implementation: `@tanstack/ai-react` hooks + `realtimeToken()`

### 2. Card Photo Recognition
- User takes a photo of a physical card
- App identifies the card and adds it to the deck
- Uses vision/image analysis models
- Implementation: Upload image → AI identifies card name → search in Scryfall DB

### 3. Voice Notes on Cards
- Record voice notes per card (replaces typing)
- Transcribed and stored as text in `deck_cards.user_note`
- AI considers transcribed notes in analysis

## Dependencies
- `@tanstack/ai-react` for client-side hooks (not yet installed)
- OpenAI realtime API access for voice
- Additional cost considerations for realtime/image APIs

## Estimated Effort
- Voice assistant: Large (WebRTC setup, UI, real-time streaming)
- Card photo: Medium (image upload, vision model, card matching)
- Voice notes: Small (transcription API + existing notes field)
