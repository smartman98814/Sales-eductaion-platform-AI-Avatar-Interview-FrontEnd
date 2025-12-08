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

  // HeyGen streaming session hook
  const {
    sessionInfo,
    peerConnection,
    isConnected,
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
   */
  const handleBackendStatusChange = useCallback((statusInfo) => {
    setBackendReady(statusInfo.connected && statusInfo.agentsReady);
  }, []);

  /**
   * Cleanup HeyGen session when browser closes/refreshes
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // If there's an active session, close it
      if (sessionInfo && sessionInfo.session_id) {
        console.log('Browser closing - cleaning up HeyGen session');
        heygenService.stopSessionSync(sessionInfo.session_id);
      }
    };

    // Add event listener for browser close/refresh
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionInfo]);

  /**
   * Handle avatar selection - Start HeyGen session immediately
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
      // Create HeyGen session with avatar's settings
      setLoadingStatus('Connecting to avatar...');
      await createNewSession(
        avatar.heygenAvatarId,
        avatar.heygenVoiceId,
        'low' // quality
      );

      setLoadingStatus('Starting video stream...');
      
      // Start the session
      const onDataChannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = () => {
          // Handle WebSocket messages if needed
        };
      };

      await startSession(null, onDataChannel);

      setLoadingStatus('Session ready!');
      
      // Wait a brief moment then transition to interview
      setTimeout(() => {
        setView('interview');
      }, 500);

    } catch (error) {
      console.error('Error creating session:', error);
      alert(`Failed to create interview session: ${error.message}`);
      setView('dashboard');
      setSelectedAvatar(null);
    }
  }, [createNewSession, startSession, backendReady]);

  /**
   * Handle exiting the interview
   */
  const handleExitInterview = useCallback(async () => {
    try {
      await closeSession();
    } catch (error) {
      console.error('Error closing session:', error);
    }
    
    setSelectedAvatar(null);
    setView('dashboard');
  }, [closeSession]);

  /**
   * Handle canceling during loading
   */
  const handleCancelLoading = useCallback(async () => {
    try {
      if (sessionInfo) {
        await closeSession();
      }
    } catch (error) {
      console.error('Error canceling:', error);
    }
    
    setSelectedAvatar(null);
    setView('dashboard');
  }, [sessionInfo, closeSession]);

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
              view === 'dashboard' ? (
                <Dashboard 
                  onAvatarSelect={handleAvatarSelect}
                  backendReady={backendReady}
                />
              ) : null
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
          
          {view === 'interview' && selectedAvatar && (
            <InterviewView 
              avatar={selectedAvatar}
              peerConnection={peerConnection}
              isConnected={isConnected}
              sendTask={sendTask}
              onExit={handleExitInterview}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
