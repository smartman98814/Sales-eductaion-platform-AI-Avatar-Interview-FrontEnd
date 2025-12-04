/**
 * Main Application Component
 * AI Avatar Interview Application - Zoom-like interview environment
 */
import { useState, useCallback } from 'react';
import { AvatarGrid } from './components/AvatarGrid';
import { InterviewView } from './components/InterviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { useStreamingSession } from './hooks/useStreamingSession';
import './index.css';

function App() {
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [view, setView] = useState('grid'); // 'grid', 'loading', or 'interview'
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');

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
   * Handle avatar selection - Start HeyGen session immediately
   */
  const handleAvatarSelect = useCallback(async (avatar) => {
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
  }, [createNewSession, startSession]);

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
      {view === 'grid' && (
        <AvatarGrid onAvatarSelect={handleAvatarSelect} />
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
