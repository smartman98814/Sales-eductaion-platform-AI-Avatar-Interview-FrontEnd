/**
 * Main Application Component
 * AI Avatar Interview Application - Zoom-like interview environment
 */
import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { LandingPage } from './components/layout/LandingPage';
import { Dashboard } from './components/layout/Dashboard';

import { Login } from './components/user_management/Login';
import { Signup } from './components/user_management/Signup';

import { ProfileSettings } from './components/user_management/ProfileSettings';
import { InterviewView } from './components/layout/InterviewView';
import { BackendStatus } from './components/layout/BackendStatus';
import { AdminPanel } from './components/admin/AdminPanel';

import { livekitService } from './services/LiveKitService';
import { useStreamingSession } from './hooks/useStreamingSession';
import { heygenService } from './services/HeyGenService';
import { authService } from './services/AuthService';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'loading', or 'interview'
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [backendReady, setBackendReady] = useState(false);
  const [livekitRoom, setLivekitRoom] = useState(null);

  // Debug: Log view state changes and force reset if stuck
  useEffect(() => { 
    // If stuck in loading/interview for more than 30 seconds, reset to dashboard
    if ((view === 'loading' || view === 'interview') && !livekitRoom) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ View stuck in', view, '- resetting to dashboard');
        setView('dashboard');
        setSelectedAvatar(null);
        setLoadingStatus('Initializing...');
      }, 30000); // 30 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [view, selectedAvatar, livekitRoom]);

  // HeyGen streaming session hook (for video)
  const {
    sessionInfo,
    peerConnection,
    isConnected: heygenConnected,
    createNewSession,
    startSession,
    closeSession,
  } = useStreamingSession();

  /**
   * Check authentication on mount
   */
  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        const isValid = await authService.verifyToken();
        if (isValid) {
          setIsAuthenticated(true);
        }
      }
    };
    checkAuth();
  }, []);

  const navigate = useNavigate();

  /**
   * Handle authentication success
   */
  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
    setView('dashboard');
    navigate('/dashboard');
  }, [navigate]);

  /**
   * Handle logout
   */
  const handleLogout = useCallback(() => {
    authService.signOut();
    setIsAuthenticated(false);
    setSelectedAvatar(null);
    setView('dashboard');
    navigate('/');
  }, [navigate]);

  /**
   * Handle backend status change
   * With LiveKit, we only need backend for token generation, so if connected, we're ready
   */
  const handleBackendStatusChange = useCallback((statusInfo) => {
    setBackendReady(statusInfo.connected);
  }, []);

  /**
   * Cleanup sessions when browser closes/refreshes
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Cleanup HeyGen session
      if (sessionInfo && sessionInfo.session_id) {
        heygenService.stopSessionSync(sessionInfo.session_id);
      }
      // Cleanup LiveKit room
      if (livekitRoom) {
        livekitService.disconnect();
      }
    };

    // Add event listener for browser close/refresh
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionInfo, livekitRoom]);

  /**
   * Handle avatar selection - Connect to both HeyGen (video) and LiveKit (audio/text)
   */
  const handleAvatarSelect = useCallback(async (avatar) => {
    if (!backendReady) {
      alert('Backend is not ready. Please wait for backend initialization to complete.');
      return;
    }

    setSelectedAvatar(avatar);
    setView('loading');
    setLoadingStatus('Creating HeyGen session...');

    try {
      // Step 1: Create HeyGen session for video
      setLoadingStatus('Connecting to HeyGen avatar...');
      await createNewSession(
        avatar.heygenAvatarId,
        avatar.heygenVoiceId,
        'low' // quality
      );

      setLoadingStatus('Starting HeyGen video stream...');
      
      // Start the HeyGen session
      const onDataChannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = () => {
          // Handle WebSocket messages if needed
        };
      };

      await startSession(null, onDataChannel);
      setLoadingStatus('HeyGen video connected ✓');

      // Step 2: Connect to LiveKit for audio/text
      setLoadingStatus('Connecting to LiveKit agent...');
      // Use a fixed room name for testing (easier for agent to connect)
      // Change back to dynamic name once agent auto-join is configured
      const roomName = `room-avatar-${avatar.id}`; // Fixed room name per avatar
      // const roomName = `room-${avatar.id}-${Date.now()}`; // Dynamic (original)
      const participantName = `user-${Date.now()}`;
      
      // Get HeyGen session_id to pass to LiveKit agent
      const heygenSessionId = sessionInfo?.session_id || null;
      
      // Connect to LiveKit room
      const room = await livekitService.connectToRoom(
        roomName,
        participantName,
        avatar.id,
        heygenSessionId,
        () => {
          // Track handling is done in InterviewView component
        },
        () => {
          setLoadingStatus('LiveKit agent connected ✓');
        },
        () => {
          setLivekitRoom(null);
        }
      );

      setLivekitRoom(room);
      
      // Agent will auto-join via roomConfig in the token (no manual dispatch needed)
      setLoadingStatus('Waiting for agent to join...');
      
      // Wait for agent to join (check every second, timeout after 10 seconds)
      let checkCount = 0;
      const maxChecks = 10;
      const agentCheckInterval = setInterval(() => {
        checkCount++;
        const agentCount = room.remoteParticipants.size;
        
        if (agentCount > 0) {
          clearInterval(agentCheckInterval);
          setLoadingStatus('Agent connected ✓');
          setTimeout(() => {
            setView('interview');
          }, 500);
        } else if (checkCount >= maxChecks) {
          clearInterval(agentCheckInterval);
          setLoadingStatus('⚠️ Agent did not join - check LIVEKIT_AGENT_NAME in .env');
          // Still transition to interview so user can see the issue
          setTimeout(() => {
            setView('interview');
          }, 2000);
        } else {
          setLoadingStatus(`Waiting for agent to join... (${checkCount}/${maxChecks})`);
        }
      }, 1000);

    } catch (error) {
      // Extract error message properly
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message || String(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = error.message || error.detail || error.error || JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }
      
      alert(`Failed to create interview session: ${errorMessage}`);
      // Reset all state to ensure clean dashboard view
      setView('dashboard');
      setSelectedAvatar(null);
      setLivekitRoom(null);
      setLoadingStatus('Initializing...');
    }
  }, [createNewSession, startSession, backendReady, sessionInfo]);

  /**
   * Handle exiting the interview
   */
  const handleExitInterview = useCallback(async () => {
    try {
      // Disconnect from LiveKit
      await livekitService.disconnect();
      // Close HeyGen session
      await closeSession();
    } catch (error) {
      // Error closing sessions - silently fail
    }
    
    setLivekitRoom(null);
    setSelectedAvatar(null);
    setView('dashboard');
  }, [closeSession]);

  /**
   * Handle canceling during loading
   */
  const handleCancelLoading = useCallback(async () => {
    try {
      if (livekitRoom) {
        await livekitService.disconnect();
      }
      if (sessionInfo) {
        await closeSession();
      }
    } catch (error) {
      // Error canceling - silently fail
    }
    
    setLivekitRoom(null);
    setSelectedAvatar(null);
    setView('dashboard');
  }, [livekitRoom, sessionInfo, closeSession]);

  // Hide navbar during interview or loading
  const showNavbar = view !== 'interview' && view !== 'loading';

  return (
    <div className="app">
      {/* Navbar - hidden during interview */}
      {showNavbar && (
        <Navbar 
          isAuthenticated={isAuthenticated}
          onAuthenticated={handleAuthenticated}
          onLogout={handleLogout}
        />
      )}

      {/* Backend Status Check - only when authenticated */}
      <BackendStatus 
        onStatusChange={handleBackendStatusChange} 
        isAuthenticated={isAuthenticated}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/signin" 
          element={
            !isAuthenticated ? (
              <Login onSuccess={handleAuthenticated} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } 
        />
        <Route 
          path="/signup" 
          element={
            !isAuthenticated ? (
              <Signup onSuccess={handleAuthenticated} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } 
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <ProfileSettings onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard 
                onAvatarSelect={handleAvatarSelect}
                backendReady={backendReady}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            isAuthenticated ? (
              <AdminPanel />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>

      {/* Interview views - shown when authenticated */}
      {isAuthenticated && (
        <>
          {view === 'loading' && selectedAvatar && (
            <LoadingScreen 
              avatar={selectedAvatar}
              status={loadingStatus}
              onCancel={handleCancelLoading}
            />
          )}
          
          {view === 'interview' && selectedAvatar && livekitRoom && (
            <InterviewView 
              avatar={selectedAvatar}
              peerConnection={peerConnection || null}
              isConnected={heygenConnected}
              livekitRoom={livekitRoom}
              heygenSessionId={sessionInfo?.session_id || null}
              onExit={handleExitInterview}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
