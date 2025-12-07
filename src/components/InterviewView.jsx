/**
 * Interview View Component
 * Zoom-like interview interface with avatar and interviewer webcam
 * Receives pre-initialized HeyGen session from parent
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { agentService } from '../services/AgentService';
import '../styles/interviewView.css';

export function InterviewView({ 
  avatar, 
  peerConnection,
  isConnected,
  sendTask,
  onExit 
}) {
  const [statusMessages, setStatusMessages] = useState([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showVoiceTest, setShowVoiceTest] = useState(false);
  const [voiceTestHistory, setVoiceTestHistory] = useState([]);

  // Webcam for interviewer
  const {
    videoRef: webcamRef,
    isActive: webcamActive,
    startWebcam,
    stopWebcam,
  } = useWebcam();

  // Track final transcript separately for test panel (since hook clears it quickly)
  const [testFinalTranscript, setTestFinalTranscript] = useState('');

  // Speech recognition for voice input
  const {
    isListening: isVoiceActive,
    transcript: finalTranscript,
    interimTranscript,
    error: voiceError,
    isSupported: voiceSupported,
    startListening: startVoice,
    stopListening: stopVoice,
  } = useSpeechRecognition({
    onTranscriptComplete: (text) => {
      console.log('Voice test panel - transcript complete:', text);
      
      // Store final transcript for test panel
      if (showVoiceTest && text.trim()) {
        setTestFinalTranscript(text);
        // Keep it for 5 seconds so user can see it
        setTimeout(() => {
          setTestFinalTranscript('');
        }, 5000);
      }
      
      // Add to test history if in test mode
      if (showVoiceTest) {
        setVoiceTestHistory(prev => [...prev, {
          text,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
      
      // Auto-send when speech is complete (only if not in test mode)
      if (text.trim() && conversationStarted && !isProcessing && !showVoiceTest) {
        handleSendMessage(text);
      }
    },
  });

  // Video ref for HeyGen avatar
  const avatarVideoRef = useRef(null);

  const updateStatus = useCallback((message) => {
    console.log('Status:', message);
    setStatusMessages((prev) => [...prev, message]);
  }, []);

  /**
   * Initialize webcam when component mounts (optional - won't block if fails)
   */
  useEffect(() => {
    const initWebcam = async () => {
      try {
        updateStatus('Starting your camera...');
        await startWebcam();
        updateStatus('Camera ready ✓');
      } catch (error) {
        updateStatus(`Camera not available (${error.message}) - continuing without webcam`);
        console.error('Webcam error:', error);
        // Don't block interview if camera fails
      }
    };

    initWebcam();

    return () => {
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Setup video stream when peer connection is ready
   */
  useEffect(() => {
    if (peerConnection && avatarVideoRef.current) {
      console.log('Setting up peer connection with avatar video');
      
      // Ensure video element is ready for audio playback
      const videoElement = avatarVideoRef.current;
      videoElement.muted = false;
      videoElement.volume = 1.0;
      
      // Check if tracks already exist (they might be added before this effect runs)
      const checkExistingTracks = () => {
        const receivers = peerConnection.getReceivers();
        console.log('Existing receivers:', receivers.length);
        
        const videoTracks = [];
        const audioTracks = [];
        
        for (const receiver of receivers) {
          if (receiver.track) {
            console.log('Found track:', receiver.track.kind);
            if (receiver.track.kind === 'video') {
              videoTracks.push(receiver.track);
            } else if (receiver.track.kind === 'audio') {
              audioTracks.push(receiver.track);
            }
          }
        }
        
        if (videoTracks.length > 0 || audioTracks.length > 0) {
          console.log(`Found ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
          const stream = new MediaStream([...videoTracks, ...audioTracks]);
          videoElement.srcObject = stream;
          updateStatus(`Avatar stream connected (Video: ${videoTracks.length}, Audio: ${audioTracks.length}) ✓`);
          // Try to play with audio
          videoElement.muted = false;
          videoElement.volume = 1.0;
          videoElement.play().catch(err => console.log('Play error:', err));
          return true;
        }
        return false;
      };

      // Try to get existing tracks first
      const hasExistingTrack = checkExistingTracks();
      
      // Set up event handler for future tracks
      peerConnection.ontrack = (event) => {
        console.log('ontrack event fired', event);
        console.log('Track kind:', event.track?.kind);
        
        if (event.streams && event.streams[0]) {
          console.log('Setting stream from ontrack (includes all tracks)');
          videoElement.srcObject = event.streams[0];
          
          // Log track info
          const stream = event.streams[0];
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          console.log(`Stream has ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
          updateStatus(`Avatar stream connected (Video: ${videoTracks.length}, Audio: ${audioTracks.length}) ✓`);
          
          // Ensure audio is enabled
          videoElement.muted = false;
          videoElement.volume = 1.0;
          videoElement.play().catch(err => console.log('Play error:', err));
        } else if (event.track) {
          console.log('Adding individual track to stream');
          // Get existing stream or create new one
          let stream = videoElement.srcObject;
          if (!stream) {
            stream = new MediaStream();
            videoElement.srcObject = stream;
          }
          
          // Add the new track
          if (event.track.kind === 'video') {
            // Replace video tracks
            stream.getVideoTracks().forEach(t => stream.removeTrack(t));
            stream.addTrack(event.track);
            console.log('Added video track');
          } else if (event.track.kind === 'audio') {
            // Replace audio tracks
            stream.getAudioTracks().forEach(t => stream.removeTrack(t));
            stream.addTrack(event.track);
            console.log('Added audio track');
          }
          
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          updateStatus(`Avatar stream updated (Video: ${videoTracks.length}, Audio: ${audioTracks.length}) ✓`);
          
          // Ensure audio is enabled
          videoElement.muted = false;
          videoElement.volume = 1.0;
          videoElement.play().catch(err => console.log('Play error:', err));
        }
      };

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        updateStatus(`Connection state: ${state}`);
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          updateStatus('WebRTC connection established ✓');
          // Double-check for tracks when connected
          if (!videoElement.srcObject) {
            console.log('No video yet, checking for tracks...');
            checkExistingTracks();
          }
        } else if (state === 'failed') {
          updateStatus('Connection failed - please try again');
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        updateStatus(`ICE connection state: ${state}`);
        console.log('ICE connection state:', state);
      };

      if (!hasExistingTrack) {
        updateStatus('Waiting for avatar video stream...');
      }
    }
  }, [peerConnection, updateStatus]);

  /**
   * Enable audio playback
   */
  const handleEnableAudio = useCallback(async () => {
    if (avatarVideoRef.current) {
      try {
        const videoElement = avatarVideoRef.current;
        
        // Log stream info
        if (videoElement.srcObject) {
          const stream = videoElement.srcObject;
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();
          console.log('Enabling audio...');
          console.log('Video tracks:', videoTracks.length, videoTracks);
          console.log('Audio tracks:', audioTracks.length, audioTracks);
          
          if (audioTracks.length === 0) {
            updateStatus('⚠️ No audio track from HeyGen - avatar may be silent');
            console.warn('HeyGen stream has no audio tracks!');
          }
        }
        
        // Force unmute and set volume
        videoElement.muted = false;
        videoElement.volume = 1.0;
        
        // Ensure it's playing
        await videoElement.play();
        
        setAudioEnabled(true);
        updateStatus('🔊 Audio enabled ✓');
        console.log('Audio successfully enabled');
      } catch (error) {
        console.error('Error enabling audio:', error);
        updateStatus('Click the avatar video to enable audio');
      }
    }
  }, [updateStatus]);

  /**
   * Request microphone permission
   */
  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      updateStatus('Microphone permission denied. Please allow microphone access in browser settings.');
      return false;
    }
  }, [updateStatus]);

  /**
   * Toggle voice input on/off
   */
  const handleToggleVoice = useCallback(async () => {
    if (isVoiceActive) {
      stopVoice();
      updateStatus('Voice input stopped');
    } else {
      if (voiceSupported) {
        try {
          // Request microphone permission first
          updateStatus('Requesting microphone permission...');
          const hasPermission = await requestMicrophonePermission();
          
          if (hasPermission) {
            startVoice();
            updateStatus('Voice input activated - speak naturally!');
          } else {
            updateStatus('Microphone access required for voice input');
          }
        } catch (error) {
          updateStatus(`Voice input error: ${error.message || 'Failed to start'}`);
          console.error('Failed to start voice input:', error);
        }
      } else {
        updateStatus('Voice input not supported in this browser. Please use Chrome, Edge, or Safari.');
      }
    }
  }, [isVoiceActive, voiceSupported, startVoice, stopVoice, updateStatus, requestMicrophonePermission]);

  /**
   * Start the conversation
   */
  const handleStartConversation = async () => {
    try {
      setConversationStarted(true);
      updateStatus('Starting conversation...');
      
      // Enable audio first
      await handleEnableAudio();
      
      // Send initial greeting through avatar
      const greeting = `Hello! I'm ${avatar.name}. ${avatar.description}`;
      await sendTask(greeting);
      updateStatus('Conversation started!');
      
      // Start voice recognition (with error handling)
      if (voiceSupported) {
        try {
          updateStatus('Requesting microphone permission...');
          const hasPermission = await requestMicrophonePermission();
          
          if (hasPermission) {
            updateStatus('Activating voice input...');
            startVoice();
            updateStatus('Voice input activated - speak naturally!');
          } else {
            updateStatus('Microphone access required. Click the mic button to enable voice input.');
          }
        } catch (error) {
          updateStatus(`Voice input error: ${error.message || 'Failed to start'}. You can still type messages.`);
          console.error('Voice input startup error:', error);
        }
      } else {
        updateStatus('Voice input not supported - please type your messages');
      }
    } catch (error) {
      updateStatus(`Error: ${error.message}`);
    }
  };

  /**
   * Send message to AI agent and make avatar speak response
   */
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || isProcessing) return;

    // Create timeout for backend response
    const timeoutMs = 30000; // 30 second timeout
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Backend response timeout - no response received in 30 seconds'));
      }, timeoutMs);
    });

    try {
      updateStatus(`You: ${message}`);
      setIsProcessing(true);
      setCurrentResponse('');

      // Get AI response from backend agent with timeout
      const streamPromise = agentService.chatWithAgentStream(
        avatar.id,
        message,
        threadId
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let isReading = true;
      let lastChunkTime = Date.now();

      // Create read timeout
      const checkTimeout = setInterval(() => {
        if (Date.now() - lastChunkTime > 15000) {
          // No data for 15 seconds
          updateStatus('⚠️ Stream timeout - no data received');
          isReading = false;
          clearInterval(checkTimeout);
        }
      }, 1000);

      while (isReading) {
        const readPromise = reader.read();
        const { done, value } = await Promise.race([
          readPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Read timeout')), 15000)
          )
        ]);

        lastChunkTime = Date.now();

        if (done) {
          isReading = false;
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different message types
              if (data.t === 's') {
                // Start - receive thread ID
                setThreadId(data.tid);
                updateStatus('✓ Connected to backend agent');
              } else if (data.t === 'c') {
                // Chunk - accumulate response
                fullResponse += data.d;
                setCurrentResponse(fullResponse);
              } else if (data.t === 'd') {
                // Done
                isReading = false;
                updateStatus('✓ AI response complete');
                break;
              } else if (data.t === 'e') {
                // Error
                throw new Error(data.e);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }

      clearInterval(checkTimeout);

      // Send the full AI response to HeyGen avatar to speak
      if (fullResponse && fullResponse.trim()) {
        updateStatus(`${avatar.name}: ${fullResponse}`);
        await sendTask(fullResponse);
        updateStatus('✓ Avatar speaking response');
      } else {
        updateStatus('⚠️ No response received from AI');
      }

      setCurrentResponse('');
      setIsProcessing(false);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error in handleSendMessage:', error);
      updateStatus(`❌ Error: ${error.message}`);
      updateStatus('Tip: Check backend terminal for errors');
      setIsProcessing(false);
      setCurrentResponse('');
    }
  }, [avatar.id, avatar.name, threadId, sendTask, updateStatus, isProcessing]);

  /**
   * Handle exit interview
   */
  const handleExit = async () => {
    try {
      updateStatus('Ending interview...');
      
      // Stop voice recognition
      if (voiceSupported && isVoiceActive) {
        stopVoice();
      }
      
      stopWebcam();
      onExit();
    } catch (error) {
      console.error('Error exiting:', error);
      onExit();
    }
  };

  return (
    <div className="interview-container">
      {/* Interviewer Webcam - Top Center */}
      <div className="webcam-container-top">
        {webcamActive ? (
          <video
            ref={webcamRef}
            autoPlay
            playsInline
            muted
            className="webcam-video"
          />
        ) : (
          <div className="webcam-placeholder">
            <div className="placeholder-icon">📹</div>
            <div className="placeholder-text">Camera Not Available</div>
          </div>
        )}
        <div className="video-label">You (Interviewer)</div>
      </div>

      {/* Avatar - Center */}
      <div className="avatar-container-center">
        <video
          ref={avatarVideoRef}
          autoPlay
          playsInline
          className="avatar-video"
          onClick={handleEnableAudio}
        />
        
        {/* Audio Enable Prompt - Always show until explicitly enabled */}
        {!audioEnabled && (
          <div className="audio-prompt">
            <button className="btn-enable-audio" onClick={handleEnableAudio}>
              🔊 Click to Enable Avatar Audio
            </button>
            <p className="audio-hint">Browser requires interaction to play sound</p>
          </div>
        )}
        
        <div className="avatar-info">
          <div 
            className="avatar-badge"
            style={{ backgroundColor: avatar.backgroundColor }}
          >
            {avatar.initials}
          </div>
          <div className="avatar-details">
            <h2>{avatar.fullName}</h2>
            <p>{avatar.role}</p>
          </div>
        </div>

        {/* Current AI Response Display */}
        {currentResponse && (
          <div className="response-overlay">
            <div className="response-text">{currentResponse}</div>
          </div>
        )}
      </div>

      {/* Control Panel - Bottom */}
      <div className="interview-controls">
        {!conversationStarted ? (
          <div className="initial-controls">
            <button 
              className="btn-primary btn-large"
              onClick={handleStartConversation}
              disabled={!isConnected}
            >
              Start Interview
            </button>
            <button 
              className="btn-primary btn-large"
              onClick={handleExit}
            >
              Close Interview
            </button>
          </div>
        ) : (
          <div className="conversation-controls">
            <VoiceIndicator 
              isActive={isVoiceActive}
              transcript={interimTranscript}
              isProcessing={isProcessing}
              onToggle={handleToggleVoice}
              voiceSupported={voiceSupported}
            />
            <TextInput
              onSend={handleSendMessage}
              disabled={isProcessing}
            />
            <button 
              className="btn-close"
              onClick={handleExit}
            >
              End Interview
            </button>
          </div>
        )}
      </div>

      {/* Voice Test Panel - Toggleable */}
      {showVoiceTest && (
        <VoiceTestPanel
          isActive={isVoiceActive}
          interimTranscript={interimTranscript}
          finalTranscript={testFinalTranscript || finalTranscript}
          error={voiceError}
          history={voiceTestHistory}
          voiceSupported={voiceSupported}
          onStart={startVoice}
          onStop={stopVoice}
          onClose={() => {
            setShowVoiceTest(false);
            setTestFinalTranscript('');
            setVoiceTestHistory([]);
          }}
          onClearHistory={() => {
            setVoiceTestHistory([]);
            setTestFinalTranscript('');
          }}
        />
      )}

      {/* Status Log - Collapsible */}
      <div className="status-log">
        <details>
          <summary>Status Log ({statusMessages.length})</summary>
          <div className="status-messages">
            {statusMessages.map((msg, idx) => (
              <div key={idx} className="status-message">
                {msg}
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Voice Test Toggle Button */}
      <button
        className="btn-voice-test"
        onClick={() => setShowVoiceTest(!showVoiceTest)}
        title="Toggle voice input test panel"
      >
        {showVoiceTest ? '✕ Hide Voice Test' : '🎤 Test Voice Input'}
      </button>
    </div>
  );
}

/**
 * Voice Indicator Component
 * Shows voice recognition status and interim transcript
 */
function VoiceIndicator({ isActive, transcript, isProcessing, onToggle, voiceSupported }) {
  return (
    <div className="voice-indicator">
      <div className="voice-status">
        <button
          className={`mic-button ${isActive ? 'mic-active' : ''} ${isProcessing ? 'mic-disabled' : ''}`}
          onClick={onToggle}
          disabled={isProcessing || !voiceSupported}
          title={isActive ? 'Click to stop voice input' : 'Click to start voice input'}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
        <div className="voice-text">
          {isProcessing ? (
            <span className="status-processing">Processing AI response...</span>
          ) : isActive && transcript ? (
            <span className="status-listening">{transcript}</span>
          ) : isActive ? (
            <span className="status-listening">🎤 Listening... Speak now</span>
          ) : voiceSupported ? (
            <span className="status-idle">Click mic to start voice</span>
          ) : (
            <span className="status-idle">Voice not supported</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Voice Test Panel Component
 * Shows real-time voice recognition feedback for testing
 */
function VoiceTestPanel({ 
  isActive, 
  interimTranscript, 
  finalTranscript, 
  error, 
  history, 
  voiceSupported,
  onStart,
  onStop,
  onClose, 
  onClearHistory 
}) {
  const handleToggle = () => {
    console.log('Voice test panel - toggle clicked, current state:', isActive);
    if (isActive) {
      console.log('Stopping voice recognition...');
      onStop();
    } else {
      console.log('Starting voice recognition...');
      onStart();
    }
  };

  return (
    <div className="voice-test-panel">
      <div className="voice-test-header">
        <h3>🎤 Voice Input Test</h3>
        <div className="voice-test-actions">
          <button className="btn-clear-history" onClick={onClearHistory}>
            Clear History
          </button>
          <button className="btn-close-panel" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="voice-test-status">
        <div className={`status-indicator ${isActive ? 'status-active' : 'status-inactive'}`}>
          <div className="status-dot"></div>
          <span>{isActive ? '🎤 Listening...' : '⏸️ Not Listening'}</span>
        </div>
        {error && (
          <div className="voice-test-error">
            ⚠️ Error: {error}
            <br />
            <small>Check browser console for more details</small>
          </div>
        )}
        {!voiceSupported && (
          <div className="voice-test-error">
            ⚠️ Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.
          </div>
        )}
        {voiceSupported && !isActive && !error && (
          <div className="voice-test-hint">
            💡 Click &quot;Start Listening&quot; button below to begin
          </div>
        )}
      </div>

      {/* Voice Control Button */}
      <div className="voice-test-controls">
        <button
          className={`btn-voice-toggle ${isActive ? 'btn-voice-active' : ''}`}
          onClick={handleToggle}
          disabled={!voiceSupported}
        >
          {isActive ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              Stop Listening
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Start Listening
            </>
          )}
        </button>
      </div>

      <div className="voice-test-display">
        <div className="voice-test-current">
          <label>Current Transcript (Real-time):</label>
          <div className="transcript-box transcript-interim">
            {interimTranscript ? (
              <span>{interimTranscript}</span>
            ) : isActive ? (
              <span className="placeholder">Listening... speak now</span>
            ) : (
              <span className="placeholder">Click &quot;Start Listening&quot; and speak to see transcript...</span>
            )}
          </div>
        </div>

        {finalTranscript && (
          <div className="voice-test-final">
            <label>Final Transcript (Last recognized):</label>
            <div className="transcript-box transcript-final">
              {finalTranscript}
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="voice-test-history">
          <label>Recognition History ({history.length}):</label>
          <div className="history-list">
            {history.slice().reverse().map((item, idx) => (
              <div key={idx} className="history-item">
                <span className="history-time">{item.timestamp}</span>
                <span className="history-text">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="voice-test-info">
        <p><strong>How to test:</strong></p>
        <ol>
          <li>Click the microphone button below to start listening</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch the &quot;Current Transcript&quot; update in real-time as you speak</li>
          <li>When you pause, the final transcript will appear</li>
          <li>All recognized text will be saved to history</li>
        </ol>
        <p className="note">Note: In test mode, recognized text will NOT be sent to the AI. Close this panel to resume normal operation.</p>
      </div>
    </div>
  );
}

/**
 * Text Input Component
 * Allows typing messages in addition to voice input
 */
function TextInput({ onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      console.log('Sending typed message:', message);
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form className="text-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Or type your message here..."
        className="text-input"
        disabled={disabled}
        autoComplete="off"
      />
      <button 
        type="submit" 
        className="btn-send"
        disabled={disabled || !message.trim()}
      >
        Send
      </button>
    </form>
  );
}
