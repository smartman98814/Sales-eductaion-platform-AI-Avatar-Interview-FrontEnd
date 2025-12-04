# Frontend Setup Guide - AI Avatar Interview

Complete guide to setting up and running the AI Avatar Interview frontend.

## Prerequisites

- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **npm**: Comes with Node.js
- **Modern Browser**: Chrome, Edge, Firefox, or Safari
- **Webcam**: Required for interview feature
- **Backend Server**: Must be running (see `backend/README.md`)

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Create Environment File

Create `.env` in the `frontend/` directory:

```env
# HeyGen Configuration
VITE_HEYGEN_API_KEY=your_heygen_api_key_here
VITE_HEYGEN_SERVER_URL=https://api.heygen.com

# Backend Configuration
VITE_BACKEND_URL=http://localhost:8000
```

### 3. Get Your HeyGen API Key

1. Go to [HeyGen](https://app.heygen.com)
2. Sign up or log in
3. Navigate to **Settings → API**
4. Copy your **API Key** or **Trial Token**
5. Paste it in `.env` as `VITE_HEYGEN_API_KEY`

### 4. Start Backend (in separate terminal)

```bash
cd backend
python run.py
```

Backend should run at `http://localhost:8000`

### 5. Initialize Backend Agents

```bash
# One-time setup
curl -X POST http://localhost:8000/api/agents/initialize
```

### 6. Start Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser!

## Detailed Setup

### Environment Variables Explained

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_HEYGEN_API_KEY` | Yes | Your HeyGen API key for avatar streaming |
| `VITE_HEYGEN_SERVER_URL` | No | HeyGen API endpoint (default: https://api.heygen.com) |
| `VITE_BACKEND_URL` | No | Backend API endpoint (default: http://localhost:8000) |

### Getting HeyGen Credentials

#### Option 1: Trial Token (Free)
1. Sign up at [HeyGen](https://app.heygen.com)
2. You get a free trial token automatically
3. Limited usage, perfect for testing

#### Option 2: API Key (Paid)
1. Add billing information in HeyGen dashboard
2. Generate production API key
3. Higher limits, suitable for production

### Avatar and Voice IDs

The app uses default public avatars. To customize:

1. Browse avatars at: https://app.heygen.com/streaming-avatar
2. Click "Select Avatar" on your chosen avatar
3. Copy the Avatar ID
4. Update `src/data/avatarData.js`:

```javascript
{
  id: 1,
  // ... other fields ...
  heygenAvatarId: 'YOUR_AVATAR_ID_HERE',
  heygenVoiceId: 'YOUR_VOICE_ID_HERE',
}
```

### Verifying Backend Connection

Test backend is running:

```bash
# Health check
curl http://localhost:8000/health

# Get agents
curl http://localhost:8000/api/agents
```

Expected response:
```json
[
  {"agent_id": 1, "name": "Maya - Rushed Salon Owner", ...},
  {"agent_id": 2, "name": "Patricia - Medical Office Manager", ...},
  ...
]
```

## Usage

### Starting an Interview

1. **Select Avatar**
   - Homepage shows 10 avatar options in a grid
   - Hover over any avatar to see details
   - Click to start interview

2. **Grant Camera Permission**
   - Browser will request webcam access
   - Click "Allow" to proceed
   - Your camera feed appears at top center

3. **Wait for Initialization**
   - Avatar session is being created
   - Your camera is activating
   - Connection is established
   - Status log shows progress

4. **Start Conversation**
   - Click "Start Interview" button
   - Avatar introduces themselves
   - Type your message in the input field
   - Press Enter or click Send

5. **Interactive Conversation**
   - AI processes your message
   - Response streams in real-time
   - Avatar speaks the response with lip-sync
   - Continue natural conversation

6. **End Interview**
   - Click "End Interview" when done
   - Returns to avatar selection screen
   - Can start new interview with different avatar

### Tips for Best Experience

**Camera Setup:**
- Ensure good lighting
- Position camera at eye level
- Plain background works best
- Check camera angle before starting

**Network:**
- Stable internet connection required
- Minimum 5 Mbps upload/download
- Avoid VPN if possible (may affect WebRTC)

**Conversation:**
- Speak naturally as you would in real sales situation
- Address objections as they come up
- Practice different scenarios with different avatars
- Use the status log to track conversation flow

## Troubleshooting

### Camera Issues

**Camera Not Found**
```
Solution: 
- Check if camera is connected
- Try unplugging and reconnecting
- Restart browser
- Check System Settings → Privacy → Camera
```

**Permission Denied**
```
Solution:
- Browser settings → Site Settings → Camera → Allow
- Clear browser cache and cookies
- Try incognito/private window
```

**Camera Used by Another App**
```
Solution:
- Close other apps using camera (Zoom, Teams, etc.)
- Restart browser
- Restart computer if needed
```

### Avatar Issues

**Avatar Not Loading**
```
Possible Causes:
1. Invalid HeyGen API key
2. Network connection issues
3. HeyGen service outage

Solutions:
- Check .env file has correct API key
- Verify API key at https://app.heygen.com/settings?nav=API
- Check browser console (F12) for error messages
- Try different network/disable VPN
```

**Avatar Not Speaking**
```
Possible Causes:
1. Backend not responding
2. OpenAI API key not configured
3. Network issues

Solutions:
- Check backend is running: curl http://localhost:8000/health
- Verify backend logs for errors
- Check backend .env has OPENAI_API_KEY
- Try sending message again
```

**Video Frozen**
```
Solutions:
- Refresh the page
- Check internet speed (speedtest.net)
- Try different browser
- Reduce quality in avatar settings
```

### Backend Connection Issues

**Cannot Connect to Backend**
```
Symptoms:
- "Failed to fetch agents" error
- Network errors in console

Solutions:
1. Verify backend is running:
   cd backend
   python run.py

2. Check backend URL in .env:
   VITE_BACKEND_URL=http://localhost:8000

3. Test backend directly:
   curl http://localhost:8000/api/agents

4. Check CORS configuration in backend
```

**Agents Not Responding**
```
Solutions:
1. Initialize agents:
   curl -X POST http://localhost:8000/api/agents/initialize

2. Check backend has OpenAI API key configured

3. Check backend terminal for error messages

4. Verify OpenAI API key is valid and has credits
```

### Browser Issues

**WebRTC Not Working**
```
Requirements:
- Use modern browser (Chrome/Edge recommended)
- HTTPS required in production (localhost works with HTTP)
- Enable WebRTC in browser settings

Chrome: chrome://flags/#enable-webrtc
Firefox: about:config → media.peerconnection.enabled → true
```

**Server-Sent Events Errors**
```
Solutions:
- Clear browser cache
- Disable browser extensions that block requests
- Try different browser
- Check network firewall settings
```

## Development

### Project Structure

```
frontend/
├── public/               # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── AvatarGrid.jsx
│   │   ├── InterviewView.jsx
│   │   └── ...
│   ├── data/           # Avatar configurations
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API services
│   ├── styles/         # CSS files
│   ├── App.jsx         # Main app
│   └── config.js       # Configuration
├── .env                # Environment variables
└── package.json        # Dependencies
```

### Running in Development

```bash
npm run dev     # Start dev server (hot reload enabled)
npm run build   # Build for production
npm run preview # Preview production build
```

### Modifying Avatars

Edit `src/data/avatarData.js`:

```javascript
export const AVATARS = [
  {
    id: 1,
    name: 'Maya',
    fullName: 'Maya - Rushed Salon Owner',
    role: 'Owner of a busy hair and nail salon',
    description: '...',
    personality: '...',
    backgroundColor: '#FF6B9D',  // Card color
    initials: 'M',               // Display initials
    heygenAvatarId: '...',       // HeyGen avatar
    heygenVoiceId: '...',        // HeyGen voice
  },
  // Add more avatars...
];
```

### Customizing Styles

**Avatar Grid:**
- Edit `src/styles/avatarGrid.css`
- Modify grid layout, card styles, hover effects

**Interview View:**
- Edit `src/styles/interviewView.css`
- Adjust video sizes, positions, colors

**Global:**
- Edit `src/index.css`
- Change fonts, global utilities

## Production Deployment

### Build for Production

```bash
npm run build
```

Output in `dist/` directory.

### Environment Variables for Production

Update `.env` with production values:

```env
VITE_HEYGEN_API_KEY=your_production_api_key
VITE_HEYGEN_SERVER_URL=https://api.heygen.com
VITE_BACKEND_URL=https://your-backend-domain.com
```

### Deployment Options

**Option 1: Vercel**
```bash
npm install -g vercel
vercel --prod
```

**Option 2: Netlify**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Option 3: Static Hosting**
- Build: `npm run build`
- Upload `dist/` folder to:
  - AWS S3 + CloudFront
  - Google Cloud Storage
  - Azure Static Web Apps
  - GitHub Pages

### Important Production Notes

1. **HTTPS Required**: Webcam only works over HTTPS (except localhost)
2. **CORS**: Configure backend to allow your production domain
3. **API Keys**: Use production API keys, not trial tokens
4. **Environment**: Set environment variables in hosting platform

## Performance Optimization

### Bundle Size

Check bundle size:
```bash
npm run build
# Check dist/ folder size
```

### Lazy Loading

Components load on-demand. No optimization needed.

### Caching

Configure cache headers on your hosting:
```
/assets/*  → Cache: 1 year
index.html → Cache: No cache
```

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully supported |
| Edge | 90+ | ✅ Fully supported |
| Firefox | 88+ | ✅ Supported |
| Safari | 14+ | ⚠️ Supported (WebRTC limitations) |
| Mobile Chrome | 90+ | ⚠️ Limited (webcam may not work) |
| Mobile Safari | 14+ | ⚠️ Limited (webcam may not work) |

## Support

### Getting Help

1. Check browser console (F12) for errors
2. Check backend terminal for errors
3. Review this guide's troubleshooting section
4. Check HeyGen status: https://status.heygen.com
5. Check OpenAI status: https://status.openai.com

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Camera permission denied" | User denied webcam access | Re-allow in browser settings |
| "Failed to fetch agents" | Backend not reachable | Start backend server |
| "Agent not initialized" | Backend agents not created | Run POST /api/agents/initialize |
| "Invalid API key" | HeyGen or OpenAI key invalid | Check .env files |
| "Network error" | Connection issue | Check internet/firewall |

## Next Steps

Once setup is complete:

1. **Test Each Avatar**: Try all 10 personas
2. **Practice Scenarios**: Use different sales approaches
3. **Customize Avatars**: Add your own avatar images
4. **Extend Backend**: Add more personas or modify existing ones
5. **Deploy**: Put it in production for your team

## Resources

- [HeyGen Documentation](https://docs.heygen.com)
- [OpenAI Documentation](https://platform.openai.com/docs)
- [WebRTC Guide](https://webrtc.org/getting-started/overview)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

---

**Ready to start interviewing? Run `npm run dev` and open http://localhost:5173!** 🎉

