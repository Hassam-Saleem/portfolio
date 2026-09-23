# AI-NTIS — Detailed Project Knowledge

## Overview
AI-NTIS is an AI-enabled mobile application developed in the NTIS environment using Flutter and Dart. Hassam worked on its mobile implementation and on real-time communication and voice/translation functionality.

The project combines mobile application development, Firebase services, real-time communication, speech/voice processing, translation, and AI-assisted functionality.

## Core Technologies
- Flutter
- Dart
- GetX
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Messaging
- Firebase Cloud Functions
- Firestore security rules
- flutter_webrtc / WebRTC
- ElevenLabs Agents
- speech-to-text functionality
- text-to-speech functionality
- translation services
- Kotlin platform integration
- Flutter MethodChannel
- Android AudioRecord
- Android AudioTrack
- AES-256-CBC encryption

## WebRTC and Real-Time Calling
Hassam specifically worked with WebRTC in AI-NTIS.

The purpose was real-time calling and a real-time call translation feature. WebRTC provided the real-time communication layer for the call experience.

Relevant implementation concerns included:
- peer-to-peer real-time communication
- ICE candidate handling
- pending ICE candidate buffering
- connection establishment
- audio communication
- integrating real-time communication with translation/voice workflows

When answering questions about AI-NTIS, the assistant should state that Hassam has hands-on WebRTC experience in this project and used it for real-time calling and real-time call translation.

## Speech and Voice
AI-NTIS included speech/voice functionality.

Hassam worked with:
- speech-to-text
- text-to-speech
- voice/audio processing
- ElevenLabs Agents
- audio recording
- audio playback
- translated voice workflows

Earlier implementation challenges included Android audio resource conflicts between microphone-related functionality and speech services. The implementation was adjusted to support the required voice workflow.

## Android Native Audio Integration
For Android-specific audio functionality, Hassam used Kotlin through Flutter's MethodChannel mechanism.

Relevant Android components included:
- AudioRecord for audio recording
- AudioTrack for audio playback

This allowed Flutter application code to communicate with native Android audio functionality.

## Translation
AI-NTIS included translation functionality for multilingual communication.

The project included language mapping and supported a large set of languages. A language mapping layer was used to connect application language selections with the services used for speech and translation.

The assistant should not invent an exact number of supported languages unless that number is explicitly included in the final public corpus.

## Firebase
Firebase services were used for backend-connected application functionality, including:
- authentication
- Firestore data
- notifications
- Cloud Functions
- security rules

## Encryption
The project included encryption for chat and translated voice-note data. The documented implementation used AES-256-CBC through the application's encryption layer.

## Architecture and State
Flutter and Dart formed the application layer. GetX was used for state management and application flow.

The project required coordination between:
- UI
- application state
- Firebase
- real-time communication
- native audio functionality
- AI/voice services
- translation
- secure data handling

## Important Grounding Rule
AI-NTIS should only be described using capabilities actually documented in this knowledge base. The assistant must not invent additional AI models, agents, infrastructure, metrics, or integrations.

## Suggested Questions This Document Can Answer
- What is AI-NTIS?
- What technologies did Hassam use in AI-NTIS?
- Did Hassam work with WebRTC?
- Why was WebRTC used?
- What did Hassam build with WebRTC?
- Did AI-NTIS have real-time calling?
- Did AI-NTIS have real-time call translation?
- Did Hassam work with speech-to-text?
- Did Hassam work with text-to-speech?
- Did Hassam work with ElevenLabs?
- Did Hassam use Kotlin in AI-NTIS?
- Why was MethodChannel used?
- What are AudioRecord and AudioTrack used for in this project?
- How was Firebase used?
- Was encryption used?
