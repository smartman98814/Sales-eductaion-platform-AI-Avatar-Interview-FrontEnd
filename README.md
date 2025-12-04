# AI Avatar Interview - Frontend

A professional Zoom-like interview environment where users can practice sales conversations with 10 unique AI customer personas powered by HeyGen streaming avatars and OpenAI.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
VITE_HEYGEN_API_KEY=your_heygen_api_key_here
VITE_HEYGEN_SERVER_URL=https://api.heygen.com
VITE_BACKEND_URL=http://localhost:8000
```

Get your HeyGen API key: https://app.heygen.com/settings?nav=API

### 3. Start Backend
In separate terminal:
```bash
cd backend
python run.py
curl -X POST http://localhost:8000/api/agents/initialize
```

### 4. Start Frontend
```bash
npm run dev
```

Open http://localhost:5173 🎉

## ✨ Features

### 🎭 10 AI Customer Personas
Each with unique personality, objections, and buying behaviors:
1. **Maya** - Salon Owner (busy, Instagram-focused)
2. **Patricia** - Medical Office Manager (sanitation concerns)
3. **Jennifer** - Corporate Receptionist (gatekeeper)
4. **Marcus** - Café Owner (budget-focused)
5. **Diane** - Marketing Manager (ROI-driven)
6. **Rick** - Dealership GM (wow-factor)
7. **Sofia** - Boutique Owner (design-focused)
8. **Robert** - CFO (numbers-driven)
9. **Amanda** - Hotel Manager (guest experience)
10. **James** - Franchise Owner (hates complexity)

### 🎙️ Voice Input (Always Active)
- **Hands-free conversation** - Just speak naturally
- **Auto-send** - Sends message when you finish speaking
- **Real-time transcription** - See your words as you speak
- **Continuous listening** - No need to click buttons

### 📹 Video Interface
- **HeyGen Avatar** - Realistic AI avatar with lip-sync (centered, 640×480px)
- **Your Webcam** - See yourself during interview (top center, 280×210px)
- **Professional Layout** - Clean, Zoom-like interface

### 🤖 AI Integration
- **Real-time Responses** - Streaming from backend API
- **Context Memory** - Conversation maintains context
- **Natural Dialogue** - Each persona responds in character

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── AvatarGrid.jsx       # Avatar selection (2×5 grid)
│   │   ├── InterviewView.jsx    # Main interview interface
│   │   └── LoadingScreen.jsx    # Session creation loading
│   ├── data/
│   │   └── avatarData.js        # 10 avatar definitions
│   ├── hooks/
│   │   ├── useStreamingSession.js  # HeyGen session
│   │   ├── useWebcam.js           # Webcam control
│   │   └── useSpeechRecognition.js # Voice input
│   ├── services/
│   │   ├── AgentService.js      # Backend API
│   │   └── HeyGenService.js     # HeyGen API
│   ├── managers/
│   │   ├── SessionManager.js    # Session lifecycle
│   │   └── WebRTCManager.js     # WebRTC connection
│   ├── styles/
│   │   ├── avatarGrid.css
│   │   ├── interviewView.css
│   │   └── loadingScreen.css
│   └── App.jsx                  # Main app
├── .env                         # Configuration
└── package.json
```

## 🎯 How to Use

### 1. Select Avatar
- View 10 customer personas in grid
- Hover to see personality details
- Click to start interview

### 2. Interview Setup
- Loading screen shows progress
- HeyGen session created automatically
- Your webcam activates
- Avatar video connects

### 3. Conduct Interview
- Click **"Start Interview"**
- Voice input activates automatically
- **Just speak naturally** - your message auto-sends
- Avatar responds in character with voice
- Continue natural back-and-forth conversation

### 4. End Interview
- Click **"End Interview"** or **"Close Interview"**
- Returns to avatar selection

## 🎤 Voice Input Guide

**How It Works:**
1. Interview starts → Microphone activates automatically 🎤
2. You speak → Words appear in real-time
3. You pause → Message auto-sends after ~1 second
4. AI responds → Avatar speaks
5. Ready for next message → Mic stays active

**Visual Indicators:**
- 🔵 **Blue mic** = Ready for your voice
- 🔴 **Red pulsing mic** = Actively listening
- ⏳ **Gray mic** = Processing AI response

**Tips:**
- Speak clearly and naturally
- Brief pause after finishing sentence
- No need to click - fully hands-free!

## 🔊 Audio Troubleshooting

**Can't hear avatar?**
1. Click **"🔊 Click to Enable Audio"** button if it appears
2. Or click directly on the avatar video
3. Check browser isn't muted
4. Check system volume

**Browsers block audio autoplay** - requires user interaction to enable.

## 📱 Browser Support

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Video | ✅ | ✅ | ✅ | ✅ |
| Webcam | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ✅ | ⚠️ iOS 14.5+ | ⚠️ Limited |
| WebRTC | ✅ | ✅ | ✅ | ✅ |

**Recommended:** Chrome or Edge for best experience

## ⚙️ Configuration

### Environment Variables

```env
# Required
VITE_HEYGEN_API_KEY=your_key_here

# Optional (with defaults)
VITE_HEYGEN_SERVER_URL=https://api.heygen.com
VITE_BACKEND_URL=http://localhost:8000
```

### Customizing Avatars

Edit `src/data/avatarData.js`:
```javascript
{
  id: 1,
  name: 'Maya',
  heygenAvatarId: 'Your_Avatar_ID',
  heygenVoiceId: 'Your_Voice_ID',
  imageUrl: 'https://...',
  // ... other fields
}
```

## 🛠️ Development

```bash
npm run dev      # Start dev server (port 5173)
npm run build    # Build for production
npm run preview  # Preview production build
```

## 🐛 Common Issues

### Avatar Not Loading
- Check HeyGen API key in `.env`
- Verify network connection
- Check browser console (F12)
- Ensure backend is running

### AI Not Responding
- Verify backend: `curl http://localhost:8000/health`
- Initialize agents: `curl -X POST http://localhost:8000/api/agents/initialize`
- Check backend has OpenAI API key

### Camera Issues
- Grant permission when prompted
- Close other apps using camera
- Try refreshing page

### Voice Input Not Working
- Use Chrome or Edge (best support)
- Grant microphone permission
- Check browser console for errors
- Fallback: Type messages manually

## 🚀 Production Deployment

### Build
```bash
npm run build
```

### Deploy
Deploy `dist/` folder to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting

### Important
- **HTTPS required** for webcam/microphone in production
- Configure CORS on backend
- Use production API keys

## 📊 Performance

- Initial load: < 2s
- Avatar selection: < 100ms
- Session creation: 2-3s
- AI response: < 2s
- Voice transcription: Real-time

## 🎯 Technical Details

### Data Flow
```
User speaks → Speech API → Auto-send
     ↓
Backend Agent API → AI response (streaming)
     ↓
HeyGen Avatar → Speaks response
     ↓
Ready for next input (mic stays active)
```

### Architecture
- **React 18** - Component framework
- **HeyGen Streaming API** - Avatar video
- **Web Speech API** - Voice input
- **WebRTC** - Real-time video
- **Server-Sent Events** - AI streaming

## 📚 Documentation

- **API Docs**: See backend API at `http://localhost:8000/docs`
- **HeyGen Docs**: https://docs.heygen.com
- **Code Comments**: Comprehensive inline documentation

## 🤝 Support

- Check browser console (F12) for errors
- Review backend logs for issues
- Ensure all API keys are valid
- Test with different browsers

---

**Built with React + HeyGen + OpenAI**
