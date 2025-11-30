# Architecture Overview

This project follows a **component-based and object-oriented** architecture for clean, maintainable code.

## Architecture Principles

1. **Separation of Concerns**: Each class/component has a single responsibility
2. **Encapsulation**: Business logic is encapsulated in classes
3. **Reusability**: Components and managers can be reused across the application
4. **Testability**: Classes and components are easily testable

## Project Structure

```
frontend/src/
├── components/          # React UI components
│   ├── AvatarSelector.jsx
│   ├── BackgroundControls.jsx
│   ├── Controls.jsx
│   ├── StatusDisplay.jsx
│   ├── VideoPlayer.jsx
│   └── VoiceSelector.jsx
├── hooks/               # Custom React hooks
│   └── useStreamingSession.js
├── managers/            # Business logic managers (OOP)
│   ├── SessionManager.js
│   └── WebRTCManager.js
├── services/            # API service classes (OOP)
│   ├── HeyGenService.js
│   └── OpenAIService.js
├── styles/             # CSS files
│   └── components.css
├── utils/              # Utility functions
│   └── fetchUtils.js
├── App.jsx             # Main application component
├── config.js           # Configuration
└── main.jsx            # Entry point
```

## Class-Based Services

### HeyGenService
**Purpose**: Encapsulates all HeyGen API interactions

**Key Methods**:
- `fetchVoices()` - Get available voices
- `fetchAvatars()` - Get available avatars
- `createSession()` - Create new streaming session
- `startSession()` - Start streaming
- `sendTask()` - Send text to avatar
- `stopSession()` - Stop/close session
- `listSessions()` - List active sessions

**Usage**:
```javascript
import { heygenService } from './services/HeyGenService';

const avatars = await heygenService.fetchAvatars();
```

### OpenAIService
**Purpose**: Handles OpenAI API communication via backend

**Key Methods**:
- `complete(prompt)` - Get AI completion

**Usage**:
```javascript
import { openaiService } from './services/OpenAIService';

const response = await openaiService.complete('Hello');
```

## Manager Classes

### SessionManager
**Purpose**: Manages streaming session lifecycle

**Responsibilities**:
- Session creation and management
- WebRTC connection coordination
- Task and AI interaction handling

**Key Methods**:
- `createSession(avatarId, voiceId, quality)`
- `startSession(onTrack, onDataChannel, onIceCandidate)`
- `sendTask(text)`
- `talkToAI(prompt)`
- `closeSession()`

### WebRTCManager
**Purpose**: Manages WebRTC peer connections

**Responsibilities**:
- Peer connection creation
- ICE candidate handling
- SDP negotiation
- Jitter buffer configuration

**Key Methods**:
- `createPeerConnection()`
- `setRemoteDescription(sdp)`
- `createAnswer()`
- `setupIceCandidateHandler(onCandidate, timeout)`
- `configureJitterBuffer(target)`


## React Components

### Component Hierarchy
```
App
├── AvatarSelector
├── VoiceSelector
├── Controls
├── StatusDisplay
└── VideoPlayer
```

### Component Responsibilities

**App.jsx**
- Main application orchestrator
- State management for UI
- Event handlers for user actions

**VideoPlayer.jsx**
- Video stream display
- Shows original HeyGen background
- Manages video element

**AvatarSelector.jsx / VoiceSelector.jsx**
- Dropdown selection
- Manual ID input
- Data loading from services

## Custom Hooks

### useStreamingSession
**Purpose**: React hook wrapper for SessionManager

**Returns**:
- `sessionInfo` - Current session data
- `peerConnection` - WebRTC connection
- `isConnected` - Connection status
- `createNewSession()` - Create session
- `startSession()` - Start streaming
- `sendTask()` - Send text
- `talkToAI()` - AI interaction
- `closeSession()` - Close session

## Data Flow

```
User Action
    ↓
App Component (Event Handler)
    ↓
useStreamingSession Hook
    ↓
SessionManager Class
    ↓
HeyGenService / OpenAIService
    ↓
API Request
    ↓
Response
    ↓
State Update
    ↓
UI Re-render
```

## Benefits of This Architecture

1. **Maintainability**: Clear separation makes code easy to understand and modify
2. **Testability**: Classes can be unit tested independently
3. **Reusability**: Services and managers can be reused in other projects
4. **Scalability**: Easy to add new features without affecting existing code
5. **Type Safety**: JSDoc comments provide type information
6. **Encapsulation**: Internal implementation details are hidden

## Adding New Features

### Adding a New Service
1. Create a new class in `services/`
2. Export singleton instance
3. Import and use in components/hooks

### Adding a New Manager
1. Create a new class in `managers/`
2. Encapsulate related business logic
3. Use in hooks or components

### Adding a New Component
1. Create component in `components/`
2. Follow single responsibility principle
3. Use services/managers for data operations

## Best Practices

1. **Services**: Handle all external API communication
2. **Managers**: Handle complex business logic and state
3. **Components**: Handle UI rendering and user interaction
4. **Hooks**: Bridge React and class-based logic
5. **Utils**: Pure utility functions with no side effects

