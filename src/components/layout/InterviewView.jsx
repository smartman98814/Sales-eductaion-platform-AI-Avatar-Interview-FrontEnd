import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from '../../hooks/useWebcam';
import { livekitService } from '../../services/LiveKitService';
import { heygenService } from '../../services/HeyGenService';
import { RoomEvent } from 'livekit-client';
import { RoomContext, useVoiceAssistant } from '@livekit/components-react';
import '../../styles/interviewView.css';
import '../../styles/chatWindow.css';

// Component that listens to agent transcriptions using useVoiceAssistant
function TranscriptionListener({ addAgentMessageToChat }) {
  const { agentTranscriptions } = useVoiceAssistant();
  const lastProcessedIndexRef = useRef(-1);
  
  // Add agent transcriptions to chat when they arrive
  useEffect(() => {
    if (agentTranscriptions && agentTranscriptions.length > 0) {
      // Process only new transcriptions (ones we haven't seen yet)
      const newTranscriptions = agentTranscriptions.slice(lastProcessedIndexRef.current + 1);
      
      if (newTranscriptions.length > 0) {
        // Always use the latest transcription (last in array)
        // This ensures we get the most complete version as chunks arrive
        const latestTranscription = agentTranscriptions[agentTranscriptions.length - 1];
        // const phraseTranscription = agentTranscriptions[agentTranscriptions.length - 7];
        
        if (latestTranscription && latestTranscription.text && latestTranscription.text.trim()) {
          const transcriptionText = latestTranscription.text.trim();
          addAgentMessageToChat(transcriptionText, { identity: 'agent' }, true);
        }
        
        // Update the last processed index to the latest
        lastProcessedIndexRef.current = agentTranscriptions.length - 1;
      }
    }
  }, [agentTranscriptions, addAgentMessageToChat]);
  
  return null; // This component just handles transcriptions
}

export function InterviewView({ 
  avatar, 
  peerConnection,
  livekitRoom,
  heygenSessionId,
  onExit 
}) {
  const [statusMessages, setStatusMessages] = useState([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [livekitConnected, setLivekitConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showCompleteMessageModal, setShowCompleteMessageModal] = useState(false);
  // const [completeMessage, setCompleteMessage] = useState('');

  // Track accumulated text and sent word count for incremental phrase sending
  // const accumulatedTextRef = useRef('');
  // const sentWordCountRef = useRef(0); // Track by word count, not character index

  // Track last sent message to HeyGen to avoid duplicates
  const lastSentToHeyGenRef = useRef('');
  const liveKitAudioActiveRef = useRef(false); // Track if LiveKit audio is currently active

  // Safe base64 encoding function that handles Unicode characters
  const safeBase64Encode = useCallback((str) => {
    try {
      // First encode to UTF-8, then to base64
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch (error) {
      // Fallback: use a simple hash if encoding fails
      let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(36);
    }
  }, []);

  // Generate unique message ID
  const generateMessageId = useCallback((participant, text, timestamp) => {
    const hash = `${participant || 'user'}-${text.substring(0, 50)}-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
    return safeBase64Encode(hash).substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
  }, [safeBase64Encode]);

  // Webcam for interviewer
  const {
    videoRef: webcamRef,
    isActive: webcamActive,
    startWebcam,
    stopWebcam,
  } = useWebcam();



  // Video ref for HeyGen avatar (video only)
  const avatarVideoRef = useRef(null);
  const roomRef = useRef(null);
  const livekitAudioRef = useRef(null); // Audio element for LiveKit audio
  // Helper: robust agent detection (case-insensitive), supports "Sage-1986"
  const isAgentIdentity = useCallback((identity) => {
    const id = (identity || '').toLowerCase();
    return ['agent', 'bot', 'dakota', 'sage-1986'].some(tag => id.includes(tag));
  }, []);

  const updateStatus = useCallback((message) => {
    setStatusMessages((prev) => [...prev, message]);
  }, []);


  useEffect(() => {
    if (livekitRoom) {
      roomRef.current = livekitRoom;
    }
  }, [livekitRoom]);

  /**
   * Create audio element for LiveKit audio playback
   */
  useEffect(() => {
    // Create audio element for LiveKit audio if it doesn't exist
    if (!livekitAudioRef.current) {
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.id = 'livekit-audio';
      document.body.appendChild(audioElement);
      livekitAudioRef.current = audioElement;
      console.log('✅ LiveKit audio element created');
    }
    
    return () => {
      // Cleanup audio element on unmount
      if (livekitAudioRef.current && livekitAudioRef.current.parentNode) {
        document.body.removeChild(livekitAudioRef.current);
        livekitAudioRef.current = null;
      }
    };
  }, []);

  /**
   * Setup LiveKit audio track handling
   */
  useEffect(() => {
    if (!livekitRoom) return;
    
    const handleTrackSubscribed = (track, publication, participant) => {
      // Only handle audio tracks from agent participants
      const isAgent = isAgentIdentity(participant?.identity);
      
      if (track.kind === 'audio' && isAgent && livekitAudioRef.current) {
        const audioElement = livekitAudioRef.current;
        
        // Mark audio as active when track is subscribed
        liveKitAudioActiveRef.current = true;
        console.log('🔄 LiveKit audio track subscribed - enabling HeyGen sends');
        
        // Attach track to audio element
        const mediaStream = new MediaStream([track.mediaStreamTrack]);
        audioElement.srcObject = mediaStream;
        
        // Listen for when the track ends (more reliable than audio element ended event)
        const handleTrackEnded = () => {
          liveKitAudioActiveRef.current = false;
          console.log('⏸️ LiveKit audio track ended - stopping HeyGen sends');
          updateStatus('⏸️ Audio ended');
        };
        
        track.on('ended', handleTrackEnded);
        
        // Also listen for when audio element ends (backup detection)
        const handleAudioEnded = () => {
          liveKitAudioActiveRef.current = false;
          console.log('⏸️ LiveKit audio element ended - stopping HeyGen sends');
          updateStatus('⏸️ Audio ended');
        };
        
        audioElement.addEventListener('ended', handleAudioEnded);
        
        audioElement.play().catch(error => {
          console.error('Failed to play LiveKit audio:', error);
          updateStatus('⚠️ LiveKit audio playback failed - may need user interaction');
        });
        
        updateStatus('LiveKit audio connected ✓');
        console.log('✅ LiveKit audio track attached from', participant?.identity);
      }
    };
    
    const handleTrackUnsubscribed = (track, publication, participant) => {
      const isAgent = isAgentIdentity(participant?.identity);
      if (track.kind === 'audio' && isAgent) {
        liveKitAudioActiveRef.current = false;
        console.log('⏸️ LiveKit audio track unsubscribed - stopping HeyGen sends');
        updateStatus('⏸️ Audio track unsubscribed');
      }
    };
    
    livekitRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    livekitRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    
    // Also check for existing audio tracks from remote participants
    livekitRoom.remoteParticipants.forEach(participant => {
      const isAgent = isAgentIdentity(participant?.identity);
      if (isAgent) {
        participant.audioTrackPublications.forEach(publication => {
          if (publication.track && publication.isSubscribed && livekitAudioRef.current) {
            const audioElement = livekitAudioRef.current;
            const mediaStream = new MediaStream([publication.track.mediaStreamTrack]);
            audioElement.srcObject = mediaStream;
            
            // Mark audio as active for existing track
            liveKitAudioActiveRef.current = true;
            
            // Listen for track ended
            const handleTrackEnded = () => {
              liveKitAudioActiveRef.current = false;
              console.log('⏸️ LiveKit audio track ended - stopping HeyGen sends');
              updateStatus('⏸️ Audio ended');
            };
            
            publication.track.on('ended', handleTrackEnded);
            
            // Listen for audio element ended
            const handleAudioEnded = () => {
              liveKitAudioActiveRef.current = false;
              console.log('⏸️ LiveKit audio element ended - stopping HeyGen sends');
              updateStatus('⏸️ Audio ended');
            };
            
            audioElement.addEventListener('ended', handleAudioEnded);
            
            audioElement.play().catch(error => {
              console.error('Failed to play existing LiveKit audio:', error);
            });
            updateStatus('LiveKit audio connected ✓');
            console.log('✅ Existing LiveKit audio track attached from', participant?.identity);
          }
        });
      }
    });
    
    return () => {
      livekitRoom.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      livekitRoom.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [livekitRoom, updateStatus, isAgentIdentity]);

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
      }
    };

    initWebcam();

    return () => {
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Setup HeyGen video connection (video only, audio muted - using LiveKit audio instead)
   */
  useEffect(() => {
    if (!peerConnection) {
      updateStatus('Waiting for HeyGen peer connection...');
      return;
    }

    if (!avatarVideoRef.current) {
      return;
    }
    
    const videoElement = avatarVideoRef.current;
    // Mute HeyGen audio - we'll use LiveKit audio instead
    videoElement.muted = true;
    videoElement.volume = 0;
    
    // Check for existing VIDEO tracks only (HeyGen element is video-only)
    const checkExistingTracks = () => {
      try {
        const receivers = peerConnection.getReceivers();
        const videoTracks = [];
        
        for (const receiver of receivers) {
          if(receiver.track && receiver.track.kind === 'video') {
            videoTracks.push(receiver.track);
          }
          // Ignore audio tracks - we'll use LiveKit audio
        }
        
        if (videoTracks.length > 0) {
          const stream = new MediaStream(videoTracks);
          videoElement.srcObject = stream;
        updateStatus('HeyGen video connected ✓');
          videoElement.play().catch(() => {});
        return true;
        }
      } catch (error) {
        updateStatus(`Error checking existing tracks: ${error?.message || error || 'unknown error'}`);
      }
      return false;
    };

    const hasExistingTrack = checkExistingTracks();
    
    // Set up event handler for future tracks
    peerConnection.ontrack = (event) => {
      if (event.track && event.track.kind === 'video') {
        let stream = videoElement.srcObject;
        if (!stream) {
          stream = new MediaStream();
          videoElement.srcObject = stream;
        }
        
        // Remove existing video tracks and add new one
        stream.getVideoTracks().forEach(t => stream.removeTrack(t));
        stream.addTrack(event.track);
      updateStatus('HeyGen video track connected ✓');
        videoElement.play().catch(() => {});
      }
      // Ignore audio tracks - we'll use LiveKit audio
    };

    if (!hasExistingTrack) {
      updateStatus('Waiting for HeyGen video stream...');
    }
  }, [peerConnection, updateStatus]);

  /**
   * Add user message to chat (reusable for both typed and transcribed messages)
   */
  const addUserMessageToChat = useCallback((messageText) => {
    if (!messageText || !messageText.trim()) {
      return;
    }
    
    const timestamp = Date.now();
    const participantId = livekitRoom?.localParticipant?.identity || 'user';
    
    setChatMessages(prev => {
      const trimmedText = messageText.trim();
      
      // Check for duplicate messages
      const isDuplicate = prev.some(msg => 
        msg.text === trimmedText && 
        msg.sender === 'user' &&
        msg.participantId === participantId &&
        Math.abs(timestamp - (msg.timestampMs || 0)) < 2000
      );
      if (isDuplicate) {
        return prev;
      }
      
      // Generate unique message ID
      let messageId = generateMessageId(participantId, trimmedText, timestamp);
      let counter = 0;
      while (prev.some(msg => msg.id === messageId)) {
        messageId = `${messageId}-${counter}`;
        counter++;
      }
      
      const userMessage = {
        id: messageId,
        text: trimmedText,
        sender: 'user',
        timestamp: new Date(timestamp).toLocaleTimeString(),
        timestampMs: timestamp,
        participantId: participantId,
      };
      
      return [...prev, userMessage];
    });
    
    updateStatus(`You: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);
  }, [livekitRoom, updateStatus, generateMessageId]);

  /**
   * Send text message via LiveKit data channel
   */
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !livekitRoom) return;
    
    try {
      // Add user message to chat
      addUserMessageToChat(message);
      setChatInput('');

      // Send via LiveKit text stream (preferred method for agent communication)
      if (livekitRoom.localParticipant) {
        try {
          // Use sendText() with 'lk.chat' topic - this is the standard way agents receive text
          await livekitRoom.localParticipant.sendText(message, {
            topic: 'lk.chat',
          });
          updateStatus(`Sent: ${message}`);
          
          // If no remote participants, warn the user
          if (livekitRoom.remoteParticipants.size === 0) {
            updateStatus('⚠️ Message sent, but no agent connected to room');
          } else {
            updateStatus('Message sent to agent');
          }
        } catch (error) {
          // Fallback to publishData if sendText fails
          try {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify({
              type: 'text_message',
              text: message,
              timestamp: Date.now(),
            }));
            await livekitRoom.localParticipant.publishData(data, { reliable: true });
            updateStatus(`Sent: ${message}`);
          } catch (fallbackError) {
            updateStatus(`Error sending message: ${fallbackError.message}`);
          }
        }
      } else {
        updateStatus('Error: Not connected to LiveKit room');
      }
    } catch (error) {
      updateStatus(`Error sending message: ${error.message}`);
    }
  }, [livekitRoom, addUserMessageToChat, updateStatus]);

  /**
   * Start the conversation automatically
   */
  const handleStartConversation = useCallback(async () => {
    if (conversationStarted) return; // Already started
    
    try {
    setConversationStarted(true);
    updateStatus('Starting conversation with LiveKit agent...');

      // Publish local microphone if available
    if (roomRef.current) {
      try {
          // Microphone is already enabled in connectToRoom, just ensure it's on
          await roomRef.current.localParticipant.setMicrophoneEnabled(true);
        updateStatus('Microphone connected - speak naturally!');
        } catch (error) {
        updateStatus('Microphone not available - agent can still hear you if enabled');
      }
    }
    updateStatus('Conversation started! Speak naturally to the agent.');
    } catch (error) {
      updateStatus(`Error: ${error.message}`);
    }
  }, [conversationStarted, roomRef, updateStatus]);

  /**
   * Handle exit interview
   */
  const handleExit = async () => {
    try {
      updateStatus('Ending interview...');
      
      // Disconnect from LiveKit room
      if (roomRef.current) {
        await livekitService.disconnect();
      }
      
      // Stop webcam (if available)
      if (typeof stopWebcam === 'function') {
      stopWebcam();
      }
      
      // Call parent's exit handler to close HeyGen session and reset state
      onExit();
    } catch (error) {
      console.error('Error during exit:', error);
      // Still call onExit to ensure cleanup happens
      onExit();
    }
  };

  // Helper function to add or update agent message to chat
  const addAgentMessageToChat = useCallback((messageText, participant, isUpdate = false) => {
    if (!messageText || !messageText.trim()) {
      return;
    }
    
    const trimmedText = messageText.trim();
    
    setChatMessages(prev => {
      
      // Always try to update the last agent message if it exists and this looks like a continuation
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].sender === 'agent') {
        const lastMessage = prev[lastIndex];
        const lastText = lastMessage.text.trim();
        
        // Check if this is a continuation of the last message
        // Transcription chunks build progressively: "Hello" -> "Hello!" -> "Hello! How" -> etc.
        const isContinuation = 
          trimmedText.startsWith(lastText) ||  // New text starts with old text
          (lastText.length > 0 && trimmedText.length > lastText.length && 
           trimmedText.substring(0, lastText.length) === lastText); // New text extends old text
        
        if (isContinuation || isUpdate) {
          // Update the existing message in place (keep same ID)
          const updated = [...prev];
          updated[lastIndex] = {
            ...lastMessage,
            text: trimmedText,
            timestamp: new Date().toLocaleTimeString(),
            timestampMs: Date.now(),
          };
          return updated;
        }
      }
      
      // Check if this exact message already exists (prevent duplicates)
      const isDuplicate = prev.some(msg => 
        msg.text === trimmedText && 
        msg.sender === 'agent'
      );
      
      if (isDuplicate) {
        return prev;
      }
           
      // Create new message only if it's not a continuation
      const timestamp = Date.now();
      const participantId = participant?.identity || 'agent';
      let messageId = generateMessageId(participantId, trimmedText, timestamp);
      
      // Ensure ID is unique by checking against existing messages
      let counter = 0;
      while (prev.some(msg => msg.id === messageId)) {
        messageId = `${messageId}-${counter}`;
        counter++;
      }
      
      const agentMessage = {
        id: messageId,
        text: trimmedText,
        sender: 'agent',
        timestamp: new Date(timestamp).toLocaleTimeString(),
        timestampMs: timestamp,
        participantId: participantId,
      };
      
      const newMessages = [...prev, agentMessage];
      return newMessages;
    });
    
    // Send message to HeyGen if:
    // 1. We have a session ID
    // 2. Text is different from last sent
    // 3. Extract and send ONLY the new portion immediately when it arrives
    // 4. Only send if LiveKit audio is active
    if (heygenSessionId && trimmedText !== lastSentToHeyGenRef.current && liveKitAudioActiveRef.current) {
      // Calculate what's NEW in this message (for fast lip-sync without repetition)
      let textToSend = trimmedText;
      if (lastSentToHeyGenRef.current && trimmedText.startsWith(lastSentToHeyGenRef.current)) {
        // Extract only the new portion that wasn't sent before
        textToSend = trimmedText.substring(lastSentToHeyGenRef.current.length).trim();
        // If no new content, don't send (prevents duplicate sends of same text)
        if (!textToSend) {
          return; // No new content to send
        }
      }
      
      // Send immediately when new text arrives - no waiting for completion or length thresholds
      // Store the FULL text for next comparison, but send only the NEW portion
      lastSentToHeyGenRef.current = trimmedText;
      
      // Send only the new portion immediately - maintains fast lip-sync
      heygenService.sendTask(heygenSessionId, textToSend)
        .then(() => {
          updateStatus(`🎤 Avatar speaking: "${textToSend.substring(0, 30)}..."`);
          console.log(`✅ Sent to HeyGen (new portion): "${textToSend}"`);
        })
        .catch(error => {
          console.error(`❌ Failed to send to HeyGen: "${textToSend}"`, error);
          updateStatus(`⚠️ HeyGen speak failed: ${error.message}`);
          // Reset last sent so we can retry
          lastSentToHeyGenRef.current = '';
        });
    } else if (!liveKitAudioActiveRef.current) {
      console.log('⏸️ LiveKit audio not active - skipping HeyGen send');
    }
    
    // Don't update status for every message update (too verbose)
    // Only update status for new messages, not updates
    if (!isUpdate) {
      updateStatus(`Agent: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);
    }
  }, [updateStatus, generateMessageId, heygenSessionId]);


  useEffect(() => {
    if (!livekitRoom) return;
    const handleTextStream = async (reader, participantInfo) => {
      try {
        // Read all text from the stream
        const message = await reader.readAll();

        const isTranscription = reader.info?.attributes?.['lk.transcribed_track_id'] != null;
        const isFinal = reader.info?.attributes?.['lk.transcription_final'] === 'true';
        const segmentId = reader.info?.attributes?.['lk.segment_id'];
        
        // Check if this is from the local participant (user)
        const isLocalParticipant = livekitRoom?.localParticipant?.identity === participantInfo?.identity;
        const isAgent = !isLocalParticipant && isAgentIdentity(participantInfo?.identity);
        
        console.log("📝 Text stream received", {
          participant: participantInfo?.identity,
          message: message.substring(0, 50),
          isTranscription,
          isFinal,
          segmentId,
          isLocalParticipant,
          isAgent
        });
        
        // Handle user transcriptions (audio input)
        if (isTranscription && isLocalParticipant && message.trim()) {
          if (isFinal) {
            // Only add final transcriptions to chat to avoid duplicates
            addUserMessageToChat(message);
            console.log('✅ Added user transcription to chat:', message);
          }
        }
        
        // Agent transcriptions are handled by TranscriptionListener component
        // (we don't need to handle them here to avoid duplicates)
      } catch (error) {
        console.error("Error in text stream handler:", error);
      }
    };

    // Register text stream handler for 'lk.transcription' topic (per LiveKit docs)
    livekitRoom.registerTextStreamHandler('lk.transcription', handleTextStream);
   
    // Set up listeners for new participants
    const handleParticipantConnected = (participant) => {
      // Check if this is an agent participant
      const isAgent = isAgentIdentity(participant?.identity);

      if (isAgent) {
        updateStatus(`✅ Agent ${participant.identity} connected!`);
        
        // Start conversation automatically when agent connects
        if (!conversationStarted) {
          setTimeout(() => {
            handleStartConversation();
          }, 1500); // Wait a bit for everything to settle
        }
      } else {
        updateStatus(`Participant ${participant.identity} connected (not an agent)`);
      }
    };

    // Also listen for participant updates
    const handleParticipantDisconnected = (participant) => {
      updateStatus(`Agent ${participant.identity} disconnected`);
    };

    livekitRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    livekitRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    if (livekitRoom.remoteParticipants.size === 0) {
      // Update UI status
      updateStatus('⚠️ Agent not connected - check agent settings in LiveKit Cloud');
    } else {
      // Agent participants are connected - start conversation automatically
      updateStatus('Agent connected - starting conversation...');
      // Wait a moment for everything to settle, then start conversation
      if (!conversationStarted) {
        setTimeout(() => {
          handleStartConversation();
        }, 1000);
      }
    }

    setLivekitConnected(true);
    
    // Periodic check for participants (for debugging) - reduced frequency to avoid spam
    const participantCheckInterval = setInterval(() => {
      const count = livekitRoom.remoteParticipants.size;
      if (count === 0) {
        // Only log warning once per minute to reduce spam
        const now = Date.now();
        if (!window.lastParticipantWarning || now - window.lastParticipantWarning > 60000) {
          updateStatus('⚠️ No remote participants in room. Waiting for agent to join...');
          window.lastParticipantWarning = now;
        }
      } else {
        const now = Date.now();
        if (!window.lastParticipantLog || now - window.lastParticipantLog > 60000) {
          window.lastParticipantLog = now;
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(participantCheckInterval);
      
      // Unregister text stream handler
      if (livekitRoom) {
        livekitRoom.unregisterTextStreamHandler('lk.transcription', handleTextStream);
      }
      
      livekitRoom.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      livekitRoom.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [livekitRoom, updateStatus, addAgentMessageToChat, addUserMessageToChat, handleStartConversation, conversationStarted, isAgentIdentity, heygenSessionId]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }, [chatMessages]);

  // Component that uses useVoiceAssistant to get agent transcriptions
  const TranscriptionHandler = () => {
    if (!livekitRoom) return null;
    
    return (
    <RoomContext.Provider value={livekitRoom}>
      <TranscriptionListener addAgentMessageToChat={addAgentMessageToChat} />
    </RoomContext.Provider>
    );
  };

  return (
    <div className="interview-container">
      <TranscriptionHandler />

      {/* Complete Message Modal - Separate window in interview screen */}
      {showCompleteMessageModal && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: '400px',
            maxHeight: '500px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            border: '2px solid #3b82f6',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✅</span>
              <span>Complete Message</span>
            </h3>
            <button
              onClick={() => setShowCompleteMessageModal(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                lineHeight: '1'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#334155';
                e.target.style.color = '#f1f5f9';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#94a3b8';
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Main Content Area */}
      <div className="interview-main-content">
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
        />
        
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

        </div>

      {/* Control Panel - Bottom */}
        <div className="interview-controls">
          {!conversationStarted ? (
            <div className="initial-controls">
              <div className="waiting-status">
                <p>⏳ Waiting for agent to connect and start conversation...</p>
                {livekitRoom?.remoteParticipants.size === 0 && (
                  <p className="status-hint">Make sure LIVEKIT_AGENT_NAME is set in your .env file</p>
                )}
              </div>
            <button 
              className="btn-primary btn-large"
              onClick={handleExit}
            >
              Close Interview
            </button>
            </div>
          ) : (
            <div className="conversation-controls">
              <div className="livekit-status">
                <p>🎤 LiveKit agent is listening - speak naturally!</p>
                <p className="status-hint">Your voice is automatically sent to the agent</p>
              </div>
            <button 
              className="btn-close"
              onClick={handleExit}
            >
              End Interview
            </button>
            </div>
          )}
        </div>


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
      </div>

      {/* Chat Window - Right Side */}
      <div className="chat-window">
        <div className="chat-header">
          <h3>💬 Chat</h3>
          <span className="chat-status">
            {livekitConnected ? (
              <>
                🟢 Connected
                {livekitRoom?.remoteParticipants.size > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                    ({livekitRoom.remoteParticipants.size} agent{livekitRoom.remoteParticipants.size > 1 ? 's' : ''})
                  </span>
                )}
              </>
            ) : (
              '🔴 Disconnected'
            )}
          </span>
        </div>
        <div className="chat-messages" id="chat-messages">
          {(() => {
            if (chatMessages.length === 0) {
              return (
            <div className="chat-empty">
              <p>No messages yet.</p>
              <p className="chat-hint">Type a message or speak to the agent!</p>
            </div>
              );
            } else {
              return chatMessages.map((msg, index) => {
                return (
                  <div key={msg.id || `msg-${index}`} className={`chat-message ${msg.sender === 'user' ? 'chat-message-user' : 'chat-message-agent'}`}>
                <div className="chat-message-header">
                      <span className="chat-message-sender">
                        {msg.sender === 'user' ? 'You' : avatar?.fullName || 'Agent'}
                      </span>
                      <span className="chat-message-time">{msg.timestamp || 'Now'}</span>
                </div>
                    <div className="chat-message-text">{msg.text || '(empty message)'}</div>
              </div>
                );
              });
            }
          })()}
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder={livekitConnected ? "Type your message..." : "Connecting..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chatInput.trim() && livekitConnected) {
                handleSendMessage(chatInput);
              }
            }}
            disabled={!livekitConnected}
          />
          <button
            className="chat-send-button"
            onClick={() => handleSendMessage(chatInput)}
            disabled={!chatInput.trim() || !livekitConnected}
            title={!livekitConnected ? "Waiting for LiveKit connection..." : "Send message"}
          >
            Send
          </button>
        </div>
        {livekitConnected && (
          <div className="chat-debug-info">
            <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', padding: '4px 16px', display: 'block' }}>
              💡 Tip: Check browser console (F12) for data channel logs.
            </small>
            {livekitRoom?.remoteParticipants.size === 0 ? (
              <small style={{ color: '#ffa500', fontSize: '10px', padding: '4px 16px', display: 'block' }}>
                ⚠️ Waiting for agent to join the room... (Check your LiveKit agent process)
              </small>
            ) : (
              <small style={{ color: '#4ade80', fontSize: '10px', padding: '4px 16px', display: 'block' }}>
                ✓ {livekitRoom.remoteParticipants.size} participant(s) in room
                {Array.from(livekitRoom.remoteParticipants.values()).map(p => {
                  const isAgent = p.identity?.includes('agent') || p.identity?.includes('bot') || p.identity?.includes('Dakota') || p.identity?.toLowerCase().includes('dakota');
                  return (
                    <span key={p.sid} style={{ marginLeft: '8px', color: isAgent ? '#4ade80' : '#93c5fd' }}>
                      {p.identity} {isAgent ? '(agent)' : '(user)'}
                    </span>
                  );
                })}
                {livekitRoom.remoteParticipants.size > 0 && !Array.from(livekitRoom.remoteParticipants.values()).some(p => 
                  p.identity?.includes('agent') || p.identity?.includes('bot') || p.identity?.includes('Dakota') || p.identity?.toLowerCase().includes('dakota')
                ) && (
                  <span style={{ marginLeft: '8px', color: '#fbbf24', fontSize: '9px' }}>
                    (No agent detected - may be voice-only)
                  </span>
                )}
              </small>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
