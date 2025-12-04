# AI Avatar Interview - Frontend

A Zoom-like interview environment where users can practice sales conversations with 10 unique AI customer personas powered by HeyGen streaming avatars.

## Features

- **10 AI Customer Personas** - Each with unique personality, objections, and buying triggers
- **Zoom-like Interface** - Professional interview environment with avatar and webcam
- **Real-time AI Responses** - Powered by OpenAI GPT models via backend API
- **HeyGen Integration** - Realistic avatar video streaming
- **Webcam Support** - See yourself during the interview
- **Streaming Responses** - Real-time text streaming for immediate feedback

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **HeyGen Streaming API** - Avatar video streaming
- **WebRTC** - Real-time video communication
- **MediaDevices API** - Webcam access

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── AvatarGrid.jsx          # Avatar selection grid (2x5)
│   │   ├── InterviewView.jsx       # Main interview interface
│   │   ├── VideoPlayer.jsx         # HeyGen video player
│   │   └── [other components]
│   ├── data/
│   │   └── avatarData.js           # 10 avatar persona definitions
│   ├── hooks/
│   │   ├── useStreamingSession.js  # HeyGen session management
│   │   └── useWebcam.js            # Webcam control hook
│   ├── services/
│   │   ├── AgentService.js         # Backend API integration
│   │   ├── HeyGenService.js        # HeyGen API client
│   │   └── OpenAIService.js        # OpenAI integration
│   ├── styles/
│   │   ├── avatarGrid.css          # Avatar grid styles
│   │   ├── interviewView.css       # Interview interface styles
│   │   └── components.css          # Component styles
│   ├── App.jsx                     # Main app component
│   ├── config.js                   # Configuration
│   └── index.css                   # Global styles
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the `frontend/` directory:

```env
# HeyGen API Configuration
VITE_HEYGEN_API_KEY=your_heygen_api_key_here
VITE_HEYGEN_SERVER_URL=https://api.heygen.com

# Backend API Configuration
VITE_BACKEND_URL=http://localhost:8000
```

### 3. Get API Keys

**HeyGen API Key:**
1. Sign up at [HeyGen](https://app.heygen.com)
2. Go to Settings → API
3. Copy your API Key or Trial Token

**Backend API:**
- Ensure the backend server is running on `http://localhost:8000`
- See `backend/README.md` for backend setup

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage Guide

### Avatar Selection

1. **View Avatars**: 10 customer personas displayed in a 2x5 grid
2. **Hover for Details**: Hover over any avatar to see their personality and traits
3. **Select Avatar**: Click an avatar to start the interview

### Interview Session

1. **Camera Setup**: Your webcam activates automatically (top center)
2. **Avatar Connection**: HeyGen avatar loads in the center
3. **Start Interview**: Click "Start Interview" to begin
4. **Conversation**:
   - Type your message in the input field
   - AI responds in character via the avatar
   - Avatar speaks the AI's response with realistic lip-sync
5. **End Interview**: Click "End Interview" to return to avatar selection

### Interview Layout

```
┌──────────────────────────────────────────┐
│         [Your Webcam - Small]            │
│                                          │
│      ┌────────────────────────┐         │
│      │                        │         │
│      │   AI Avatar (Large)    │         │
│      │     Speaking Center    │         │
│      │                        │         │
│      └────────────────────────┘         │
│                                          │
│    [Message Input & Controls]           │
└──────────────────────────────────────────┘
```

## The 10 AI Customer Personas

1. **Maya** - Rushed Salon Owner (busy, Instagram-obsessed)
2. **Patricia** - Medical Office Manager (detail-oriented, sanitation concerns)
3. **Jennifer** - Corporate Receptionist (gatekeeper, protective)
4. **Marcus** - Café Owner (budget-focused, compares to Costco)
5. **Diane** - Marketing Manager (ROI-driven, needs case studies)
6. **Rick** - Dealership GM (sales-driven, wants wow-factor)
7. **Sofia** - Boutique Owner (design-focused, aesthetic concerns)
8. **Robert** - CFO (numbers-driven, demands proof)
9. **Amanda** - Hotel Manager (guest-obsessed, thinks at scale)
10. **James** - Franchise Owner (8-12 locations, hates complexity)

Each persona has:
- Unique personality and communication style
- Specific objections and concerns
- Buying triggers that influence their decisions
- Realistic conversational patterns

## Key Features

### Real-time Streaming

- **AI Responses**: Streamed word-by-word from backend
- **Avatar Speech**: HeyGen avatar speaks responses with lip-sync
- **Low Latency**: < 2 second response time

### Webcam Integration

- **Auto-activation**: Camera starts automatically when interview begins
- **Mirror Effect**: Your video is mirrored for natural viewing
- **Compact Display**: Small frame at top center doesn't obstruct avatar

### Responsive Design

- Adapts to different screen sizes
- Mobile-friendly (recommended 768px+ width)
- Maintains aspect ratios for video feeds

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Adding New Avatars

1. Edit `src/data/avatarData.js`
2. Add new avatar object with all required fields
3. Update backend `agent_configs.py` with matching persona
4. Ensure HeyGen avatar and voice IDs are configured

### Customizing Styles

- **Avatar Grid**: Edit `src/styles/avatarGrid.css`
- **Interview View**: Edit `src/styles/interviewView.css`
- **Global Styles**: Edit `src/index.css`

## Browser Requirements

- **Chrome/Edge**: Recommended (best WebRTC support)
- **Firefox**: Supported
- **Safari**: Supported (may have WebRTC limitations)

**Required Browser Features:**
- WebRTC support
- MediaDevices API (webcam access)
- Server-Sent Events (SSE)
- ES6+ JavaScript

## Troubleshooting

### Camera Not Working

1. Grant camera permissions in browser
2. Check if camera is being used by another app
3. Try refreshing the page
4. Check browser console for errors

### Avatar Not Loading

1. Verify HeyGen API key in `.env`
2. Check network connection
3. Ensure HeyGen avatar IDs are valid
4. Check browser console for errors

### AI Not Responding

1. Verify backend is running (`http://localhost:8000`)
2. Check backend API key is configured
3. Verify agent initialization: `POST http://localhost:8000/api/agents/initialize`
4. Check browser console and backend logs

### Video Quality Issues

1. Check internet connection speed
2. Try reducing video quality in HeyGen session creation
3. Close other bandwidth-heavy applications

## API Integration

### Backend Endpoints Used

```javascript
// Get all agents
GET /api/agents

// Initialize agents
POST /api/agents/initialize

// Chat with agent (streaming)
POST /api/agents/{id}/chat/stream
Body: { message, thread_id, buffer_by_sentence }
```

### HeyGen Endpoints Used

```javascript
// Create streaming session
POST /v1/streaming.new

// Start session
POST /v1/streaming.start

// Send task (make avatar speak)
POST /v1/streaming.task

// Stop session
POST /v1/streaming.stop
```

## Performance Optimization

- **Lazy Loading**: Components loaded on demand
- **WebRTC**: Direct peer-to-peer video streaming
- **Streaming Responses**: Incremental text display
- **Optimized Assets**: Minimal bundle size

## Security Considerations

- API keys stored in environment variables (never in code)
- HTTPS required for webcam access in production
- CORS configured on backend
- No sensitive data logged to console in production

## Future Enhancements

- [ ] Add custom avatar image uploads
- [ ] Record interview sessions
- [ ] Performance analytics and scoring
- [ ] Multiple language support
- [ ] Screen sharing capability
- [ ] Interview replay feature

## License

ISC

## Support

For issues or questions:
- Check browser console for errors
- Review backend logs
- Ensure all environment variables are set correctly
- Verify API keys are valid and have proper permissions

