/**
 * Main Application Component
 * AI Avatar Interview Application - Zoom-like interview environment
 */
import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';
import { ProfileSettings } from './components/ProfileSettings';
import { InterviewView } from './components/InterviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { BackendStatus } from './components/BackendStatus';
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
    console.log('🔍 View state changed:', view, 'selectedAvatar:', selectedAvatar?.id, 'livekitRoom:', !!livekitRoom);
    
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
    sendTask,
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
        console.log('Browser closing - cleaning up HeyGen session');
        heygenService.stopSessionSync(sessionInfo.session_id);
      }
      // Cleanup LiveKit room
      if (livekitRoom) {
        console.log('Browser closing - cleaning up LiveKit room');
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
      
      // Log room name for agent configuration
      console.log('🔷 Connecting to LiveKit room:', roomName);
      console.log('🔷 IMPORTANT: Configure your LiveKit agent to join rooms matching pattern: room-avatar-*');
      console.log('🔷 Or configure agent to auto-join when participants connect');
      
      // Connect to LiveKit room
      const room = await livekitService.connectToRoom(
        roomName,
        participantName,
        avatar.id,
        (track, publication, participant) => {
          console.log('LiveKit track subscribed in App:', track.kind, 'from', participant.identity);
          // Track handling is done in InterviewView component
        },
        (participant) => {
          console.log('LiveKit participant connected:', participant.identity);
          setLoadingStatus('LiveKit agent connected ✓');
        },
        () => {
          console.log('Disconnected from LiveKit room');
          setLivekitRoom(null);
        }
      );

      setLivekitRoom(room);
      
      // Agent will auto-join via roomConfig in the token (no manual dispatch needed)
      setLoadingStatus('Waiting for agent to join...');
      
      setLoadingStatus('All connections ready!');
      
      // Wait a brief moment then transition to interview
      setTimeout(() => {
        setView('interview');
      }, 500);

    } catch (error) {
      console.error('❌ Error creating session:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      alert(`Failed to create interview session: ${error.message}\n\nCheck browser console (F12) for details.`);
      // Reset all state to ensure clean dashboard view
      setView('dashboard');
      setSelectedAvatar(null);
      setLivekitRoom(null);
      setLoadingStatus('Initializing...');
      console.log('✅ State reset to dashboard');
    }
  }, [createNewSession, startSession, backendReady]);

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
      console.error('Error closing sessions:', error);
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
      console.error('Error canceling:', error);
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

      {/* Debug Panel - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          fontSize: '12px',
          zIndex: 9999,
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          <div>View: <strong>{view}</strong></div>
          <div>Auth: {isAuthenticated ? '✅' : '❌'}</div>
          <div>Backend: {backendReady ? '✅' : '❌'}</div>
          <div>Avatar: {selectedAvatar ? selectedAvatar.id : 'none'}</div>
          <div>LiveKit: {livekitRoom ? '✅' : '❌'}</div>
          <button 
            onClick={() => {
              setView('dashboard');
              setSelectedAvatar(null);
              setLivekitRoom(null);
              console.log('🔄 Manual reset to dashboard');
            }}
            style={{ marginTop: '5px', padding: '5px', cursor: 'pointer' }}
          >
            Reset to Dashboard
          </button>
        </div>
      )}

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
              sendTaskToHeyGen={sendTask}
              onExit={handleExitInterview}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
