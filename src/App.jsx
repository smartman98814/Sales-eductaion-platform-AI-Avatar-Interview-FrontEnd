/**
 * Main Application Component
 * Orchestrates all components and manages application state
 */
import { useState, useCallback } from 'react';
import { AvatarSelector } from './components/AvatarSelector';
import { VoiceSelector } from './components/VoiceSelector';
import { VideoPlayer } from './components/VideoPlayer';
import { StatusDisplay } from './components/StatusDisplay';
import { Controls } from './components/Controls';
import { useStreamingSession } from './hooks/useStreamingSession';
import { heygenService } from './services/HeyGenService';

function App() {
  const [avatarId, setAvatarId] = useState('');
  const [avatarIdManual, setAvatarIdManual] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceIdManual, setVoiceIdManual] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [statusMessages, setStatusMessages] = useState(['Please click the new button to create the stream first.']);

  const {
    sessionInfo,
    peerConnection,
    isConnected,
    createNewSession,
    startSession,
    sendTask,
    talkToAI,
    closeSession,
  } = useStreamingSession();

  const updateStatus = useCallback((message) => {
    setStatusMessages(prev => [...prev, message]);
  }, []);

  const getSelectedAvatar = useCallback(() => {
    return avatarIdManual.trim() || avatarId;
  }, [avatarId, avatarIdManual]);

  const getSelectedVoice = useCallback(() => {
    return voiceIdManual.trim() || voiceId;
  }, [voiceId, voiceIdManual]);

  const handleCreateSession = useCallback(async () => {
    const avatar = getSelectedAvatar();
    const voice = getSelectedVoice();

    if (!voice || voice.trim() === '') {
      alert('Please select a voice from the dropdown or enter a voice ID manually');
      updateStatus('Error: No voice selected');
      return;
    }

    if (!avatar || avatar.trim() === '') {
      alert('Please select an avatar from the dropdown or enter an avatar ID manually');
      updateStatus('Error: No avatar selected');
      return;
    }

    updateStatus(`Using avatar ID: ${avatar}, voice ID: ${voice}`);
    updateStatus('Creating new session... please wait');

    try {
      await createNewSession(avatar, voice, 'low');
      updateStatus('Session creation completed');
      updateStatus('Now. You can click the start button to start the stream');
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      updateStatus(`Error: ${errorMessage}`);
      
      if (errorMessage.toLowerCase().includes('concurrent') || errorMessage.toLowerCase().includes('limit')) {
        updateStatus('Tip: Click "Manage Sessions" button to view and close existing sessions.');
      } else if (errorMessage.toLowerCase().includes('avatar not found') || 
                 errorMessage.toLowerCase().includes('not an interactive avatar') ||
                 errorMessage.toLowerCase().includes('not a streaming avatar')) {
        updateStatus('Tip: Only Streaming Avatars (Interactive Avatars) can be used for streaming.');
        updateStatus('Get valid avatar IDs from: https://app.heygen.com/streaming-avatar');
      }
    }
  }, [getSelectedAvatar, getSelectedVoice, createNewSession, updateStatus]);

  const handleStartSession = useCallback(async () => {
    if (!sessionInfo) {
      updateStatus('Please create a connection first');
      return;
    }

    updateStatus('Starting session... please wait');

    try {
      const onDataChannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = () => {
          // Received WebSocket message
        };
      };

      await startSession(null, onDataChannel);

      if (peerConnection) {
        // Set up error handlers
        peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection.iceConnectionState;
          updateStatus(`ICE connection state: ${state}`);
          if (state === 'connected' || state === 'completed') {
            updateStatus('WebRTC connection established - video should appear shortly');
          } else if (state === 'failed') {
            updateStatus('WebRTC connection failed - check network settings');
            // Try to restart ICE once
            if (peerConnection.iceConnectionState === 'failed') {
              peerConnection.restartIce();
            }
          } else if (state === 'disconnected') {
            updateStatus('WebRTC connection disconnected - reconnecting...');
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          updateStatus(`Connection state: ${state}`);
          if (state === 'failed') {
            updateStatus('Connection failed - check network/VPN settings or try creating a new session');
          }
        };

        // Handle ICE candidate errors
        peerConnection.onicecandidateerror = (event) => {
          updateStatus(`ICE candidate error: ${event.errorCode} - ${event.errorText || 'Unknown error'}`);
        };
      }

      updateStatus('Session started successfully - waiting for video stream...');
    } catch (error) {
      updateStatus(`Error starting session: ${error.message}`);
    }
  }, [sessionInfo, startSession, peerConnection, updateStatus]);

  const handleSendTask = useCallback(async () => {
    if (!sessionInfo) {
      updateStatus('Please create a connection first');
      return;
    }

    const text = taskInput.trim();
    if (!text) {
      alert('Please enter a task');
      return;
    }

    updateStatus('Sending task... please wait');

    try {
      await sendTask(text);
      updateStatus('Task sent successfully');
    } catch (error) {
      updateStatus(`Error sending task: ${error.message}`);
    }
  }, [sessionInfo, taskInput, sendTask, updateStatus]);

  const handleTalk = useCallback(async () => {
    if (!sessionInfo) {
      updateStatus('Please create a connection first');
      return;
    }

    const prompt = taskInput.trim();
    if (!prompt) {
      alert('Please enter a prompt for the LLM');
      return;
    }

    updateStatus('Talking to LLM... please wait');

    try {
      await talkToAI(prompt);
      updateStatus('LLM response sent successfully');
    } catch (error) {
      updateStatus(`Error talking to AI: ${error.message}`);
    }
  }, [sessionInfo, taskInput, talkToAI, updateStatus]);

  const handleCloseSession = useCallback(async () => {
    if (!sessionInfo) {
      updateStatus('Please create a connection first');
      return;
    }

    updateStatus('Closing connection... please wait');

    try {
      await closeSession();
      updateStatus('Connection closed successfully');
    } catch (error) {
      updateStatus(`Error closing connection: ${error.message}`);
    }
  }, [sessionInfo, closeSession, updateStatus]);

  const handleChangeVoice = useCallback(async () => {
    const newVoiceId = getSelectedVoice();
    if (!newVoiceId || newVoiceId.trim() === '') {
      alert('Please select a voice from the dropdown or enter a voice ID manually');
      return;
    }

    if (sessionInfo) {
      updateStatus('Closing current session to change voice...');
      try {
        await closeSession();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error('Failed to close the connection:', err);
      }
    }

    updateStatus('Creating new session with updated voice...');
    try {
      await handleCreateSession();
      await new Promise(resolve => setTimeout(resolve, 500));
      await handleStartSession();
      updateStatus('Voice changed successfully!');
    } catch (error) {
      updateStatus(`Error changing voice: ${error.message}`);
    }
  }, [sessionInfo, getSelectedVoice, closeSession, handleCreateSession, handleStartSession, updateStatus]);

  const handleManageSessions = useCallback(async () => {
    updateStatus('=== Session Management ===');
    try {
      const sessions = await heygenService.listSessions();
      
      if (sessions.length === 0) {
        updateStatus('No active sessions found. You can create a new session.');
        return;
      }

      updateStatus(`Found ${sessions.length} active session(s):`);
      sessions.forEach((session, index) => {
        const sessionId = session.session_id || session.id;
        const createdAt = session.created_at || session.createdAt || 'Unknown';
        updateStatus(`${index + 1}. Session ID: ${sessionId} (Created: ${createdAt})`);
      });

      updateStatus('---');
      updateStatus('Click "Close All Sessions" to close all active sessions, or wait a few minutes for them to auto-close.');
    } catch (error) {
      updateStatus(`Error managing sessions: ${error.message}`);
    }
  }, [updateStatus]);

  const handleCloseAllSessions = useCallback(async () => {
    updateStatus('Fetching active sessions...');
    try {
      const sessions = await heygenService.listSessions();
      
      if (sessions.length === 0) {
        updateStatus('No active sessions found.');
        return;
      }

      updateStatus(`Found ${sessions.length} active session(s). Closing...`);
      
      let closedCount = 0;
      let failedCount = 0;

      for (const session of sessions) {
        const sessionId = session.session_id || session.id;
        if (!sessionId) continue;

        updateStatus(`Closing session: ${sessionId.substring(0, 8)}...`);
        const result = await heygenService.closeSessionById(sessionId);
        
        if (result.success) {
          closedCount++;
        } else {
          failedCount++;
          updateStatus(`Failed to close session ${sessionId.substring(0, 8)}: ${result.error}`);
        }
      }

      updateStatus(`Closed ${closedCount} session(s). ${failedCount > 0 ? `Failed to close ${failedCount} session(s).` : ''}`);
    } catch (error) {
      updateStatus(`Error closing sessions: ${error.message}`);
    }
  }, [updateStatus]);

  const handleVoiceChange = useCallback(() => {
    // Placeholder for future voice change logic
  }, []);

  return (
    <div className="main">
      <div className="actionRowsWrap">
        <AvatarSelector
          value={avatarId}
          onChange={setAvatarId}
          onManualChange={setAvatarIdManual}
          manualValue={avatarIdManual}
        />
        <VoiceSelector
          value={voiceId}
          onChange={setVoiceId}
          onManualChange={setVoiceIdManual}
          manualValue={voiceIdManual}
          onVoiceChange={handleVoiceChange}
        />
        <Controls
          onCreateSession={handleCreateSession}
          onStartSession={handleStartSession}
          onChangeVoice={handleChangeVoice}
          onCloseSession={handleCloseSession}
          onManageSessions={handleManageSessions}
          onCloseAllSessions={handleCloseAllSessions}
          onSendTask={handleSendTask}
          onTalk={handleTalk}
          taskInput={taskInput}
          onTaskInputChange={setTaskInput}
          isConnected={isConnected}
          hasSession={!!sessionInfo}
        />
      </div>

      <StatusDisplay messages={statusMessages} />

      {sessionInfo && (
        <VideoPlayer
          peerConnection={peerConnection}
        />
      )}
    </div>
  );
}

export default App;
