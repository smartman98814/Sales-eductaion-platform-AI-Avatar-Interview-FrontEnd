/**
 * Main Application Component
 * AI Avatar Interview Application - Zoom-like interview environment
 */
import { useState, useCallback, useEffect } from 'react';
import { AvatarGrid } from './components/AvatarGrid';
import { InterviewView } from './components/InterviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { BackendStatus } from './components/BackendStatus';
import { useStreamingSession } from './hooks/useStreamingSession';
import { heygenService } from './services/HeyGenService';
import './index.css';

function App() {
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [view, setView] = useState('grid'); // 'grid', 'loading', or 'interview'
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
   * Handle backend status change
   */
  const handleBackendStatusChange = useCallback((statusInfo) => {
    setBackendReady(statusInfo.connected && statusInfo.agentsReady);
  }, []);

  /**
   * Cleanup HeyGen session when browser closes/refreshes
   */
  useEffect(() => {
    const handleBeforeUnload = (event) => {
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
      setView('grid');
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
    setView('grid');
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
    setView('grid');
  }, [sessionInfo, closeSession]);

  return (
    <div className="app">
      {/* Backend Status Check */}
      <BackendStatus onStatusChange={handleBackendStatusChange} />

      {view === 'grid' && (
        <AvatarGrid 
          onAvatarSelect={handleAvatarSelect}
          backendReady={backendReady}
        />
      )}
      
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
    </div>
  );
}

export default App;
