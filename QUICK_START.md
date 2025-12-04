# Quick Start - AI Avatar Interview

## 🚀 Get Running in 3 Minutes

### Step 1: Install & Configure (1 min)

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` and add your HeyGen API key:
```env
VITE_HEYGEN_API_KEY=your_heygen_api_key_here
```

Get your key: https://app.heygen.com/settings?nav=API

### Step 2: Start Backend (30 sec)

In a separate terminal:
```bash
cd backend
python run.py
```

Then initialize agents (one-time):
```bash
curl -X POST http://localhost:8000/api/agents/initialize
```

### Step 3: Start Frontend (30 sec)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 🎉

## 🎯 What You'll See

### Avatar Selection Screen
```
╔══════════════════════════════════════════════════════╗
║  Select Your Interview Customer                      ║
║  Choose one of 10 AI customer personas               ║
║                                                       ║
║  [Maya]  [Patricia]  [Jennifer]  [Marcus]  [Diane]  ║
║  [Rick]  [Sofia]     [Robert]    [Amanda]  [James]  ║
║                                                       ║
║  Hover over any avatar to see their details         ║
║  Click to start interview                            ║
╚══════════════════════════════════════════════════════╝
```

### Interview Screen
```
╔══════════════════════════════════════════════════════╗
║              [Your Webcam - Small]                   ║
║                                                       ║
║         ┌────────────────────────┐                  ║
║         │                        │                  ║
║         │   AI Avatar (Large)    │                  ║
║         │   Speaking & Listening │                  ║
║         │                        │                  ║
║         └────────────────────────┘                  ║
║                                                       ║
║   [Type your message here...] [Send] [End]          ║
╚══════════════════════════════════════════════════════╝
```

## 💡 Usage

1. **Select Avatar**: Click any of the 10 customer personas
2. **Allow Camera**: Grant webcam permission when prompted
3. **Start Interview**: Click "Start Interview" button
4. **Converse**: Type messages and get AI responses
5. **Listen**: Avatar speaks the AI's response with lip-sync
6. **End**: Click "End Interview" when done

## 🎭 The 10 Personas

1. **Maya** - Salon Owner (busy, Instagram-focused)
2. **Patricia** - Medical Office Manager (sanitation concerns)
3. **Jennifer** - Corporate Receptionist (gatekeeper)
4. **Marcus** - Café Owner (budget-focused)
5. **Diane** - Marketing Manager (ROI-driven)
6. **Rick** - Dealership GM (wow-factor obsessed)
7. **Sofia** - Boutique Owner (design-focused)
8. **Robert** - CFO (numbers-driven)
9. **Amanda** - Hotel Manager (guest experience)
10. **James** - Franchise Owner (hates complexity)

## ⚠️ Troubleshooting

**Camera not working?**
- Grant permission in browser
- Close other apps using camera
- Try refreshing the page

**Avatar not responding?**
- Check backend is running on port 8000
- Verify agents are initialized
- Check browser console (F12) for errors

**Connection issues?**
- Verify `.env` has correct API keys
- Check internet connection
- Try different browser (Chrome recommended)

## 📚 Full Documentation

- **Setup Guide**: `frontend/SETUP_GUIDE.md`
- **Full README**: `frontend/README.md`
- **Update Summary**: `FRONTEND_UPDATE_SUMMARY.md`

## 🎉 That's It!

You're ready to start practicing sales conversations with AI customers!

