import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from '../../hooks/useWebcam';
import { livekitService } from '../../services/LiveKitService';
import { heygenService } from '../../services/HeyGenService';
import { authService } from '../../services/AuthService';
import { config } from '../../config';
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
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [interviewScore, setInterviewScore] = useState(null);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [interviewStartTime] = useState(new Date());
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
        
        // Mute LiveKit audio - we'll use HeyGen audio instead
        audioElement.muted = true;
        audioElement.volume = 0;
        
        // Mark audio as active when track is subscribed (for triggering HeyGen text sends)
        liveKitAudioActiveRef.current = true;
        console.log('🔄 LiveKit audio detected (muted) - enabling HeyGen sends');
        
        // Don't attach track to audio element - we're using HeyGen audio
        // Still listen for track events to detect when audio ends
        const handleTrackEnded = () => {
          liveKitAudioActiveRef.current = false;
          console.log('⏸️ LiveKit audio track ended - stopping HeyGen sends');
          updateStatus('⏸️ Audio ended');
        };
        
        track.on('ended', handleTrackEnded);
        
        updateStatus('LiveKit audio detected (using HeyGen audio) ✓');
        console.log('✅ LiveKit audio track detected (muted) from', participant?.identity);
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
            
            // Mute LiveKit audio - we'll use HeyGen audio instead
            audioElement.muted = true;
            audioElement.volume = 0;
            
            // Mark audio as active for existing track (for triggering HeyGen text sends)
            liveKitAudioActiveRef.current = true;
            
            // Listen for track ended
            const handleTrackEnded = () => {
              liveKitAudioActiveRef.current = false;
              console.log('⏸️ LiveKit audio track ended - stopping HeyGen sends');
              updateStatus('⏸️ Audio ended');
            };
            
            publication.track.on('ended', handleTrackEnded);
            
            updateStatus('LiveKit audio detected (using HeyGen audio) ✓');
            console.log('✅ Existing LiveKit audio track detected (muted) from', participant?.identity);
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
   * Setup HeyGen video and audio connection (using HeyGen audio, LiveKit audio muted)
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
    // Enable HeyGen audio - we're using HeyGen audio instead of LiveKit audio
    videoElement.muted = false;
    videoElement.volume = 1.0;
    
    // Check for existing VIDEO and AUDIO tracks
    const checkExistingTracks = () => {
      try {
        const receivers = peerConnection.getReceivers();
        const videoTracks = [];
        const audioTracks = [];
        
        for (const receiver of receivers) {
          if(receiver.track && receiver.track.kind === 'video') {
            videoTracks.push(receiver.track);
          }
          // Handle audio tracks - we're using HeyGen audio
          if(receiver.track && receiver.track.kind === 'audio') {
            audioTracks.push(receiver.track);
          }
        }
        
        if (videoTracks.length > 0) {
          const stream = new MediaStream([...videoTracks, ...audioTracks]);
          videoElement.srcObject = stream;
          if (audioTracks.length > 0) {
            updateStatus('HeyGen video + audio connected ✓');
          } else {
            updateStatus('HeyGen video connected ✓');
          }
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
      if (event.track) {
        let stream = videoElement.srcObject;
        if (!stream) {
          stream = new MediaStream();
          videoElement.srcObject = stream;
        }
        
        if (event.track.kind === 'video') {
          // Remove existing video tracks and add new one
          stream.getVideoTracks().forEach(t => stream.removeTrack(t));
          stream.addTrack(event.track);
          updateStatus('HeyGen video track connected ✓');
        }
        
        // Handle audio tracks - we're using HeyGen audio
        if (event.track.kind === 'audio') {
          // Remove existing audio tracks and add new one
          stream.getAudioTracks().forEach(t => stream.removeTrack(t));
          stream.addTrack(event.track);
          updateStatus('HeyGen audio track connected ✓');
        }
        
        videoElement.play().catch(() => {});
      }
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
   * Perform cleanup operations (disconnect, delete room, etc.)
   */
  const performCleanup = async () => {
    // Get room name before disconnecting
    const roomName = roomRef.current?.name || null;
    
    // Disconnect from LiveKit room
    if (roomRef.current) {
      await livekitService.disconnect();
    }
    
    // Delete the LiveKit room to ensure it's closed immediately
    if (roomName) {
      try {
        // URL encode room name for safe path parameter
        const encodedRoomName = encodeURIComponent(roomName);
        const response = await fetch(`${config.backend.baseUrl}/api/livekit/room/${encodedRoomName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeader(),
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Room deleted:', result);
          updateStatus('Room closed ✓');
        } else {
          console.warn('Failed to delete room (non-critical):', response.status);
        }
      } catch (error) {
        console.error('Error deleting room (non-critical):', error);
        // Don't block exit if room deletion fails
      }
    }
    
    // Stop webcam (if available)
    if (typeof stopWebcam === 'function') {
      stopWebcam();
    }
    
    // Call parent's exit handler to close HeyGen session and reset state
    onExit();
  };

  /**
   * Handle closing score modal and complete exit
   */
  const handleCloseScoreModal = async () => {
    setShowScoreModal(false);
    setInterviewScore(null);
    await performCleanup();
  };

  /**
   * Handle exit interview
   */
  const handleExit = async () => {
    try {
      updateStatus('Ending interview...');
      
      // Calculate interview score before cleanup (only if there are messages)
      if (chatMessages.length > 0 && !isCalculatingScore) {
        setIsCalculatingScore(true);
        updateStatus('Calculating interview score...');
        
        try {
          // Step 1: Calculate score
          const scoreResponse = await fetch(`${config.backend.baseUrl}/api/interviews/score`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authService.getAuthHeader(),
            },
            body: JSON.stringify({
              agent_id: avatar.id,
              agent_name: avatar.name,
              agent_role: avatar.role,
              messages: chatMessages.map(msg => ({
                text: msg.text,
                sender: msg.sender,
                timestamp: msg.timestamp,
                timestamp_ms: msg.timestampMs
              }))
            })
          });
          
          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            setInterviewScore(scoreData);
            setShowScoreModal(true);
            updateStatus('Score calculated ✓');
            
            // Step 2: Save conversation to database
            try {
              const saveResponse = await fetch(`${config.backend.baseUrl}/api/conversations`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...authService.getAuthHeader(),
                },
                body: JSON.stringify({
                  conversation: {
                    agent_id: avatar.id,
                    agent_name: avatar.name,
                    agent_role: avatar.role,
                    room_name: roomRef.current?.name || null,
                    started_at: interviewStartTime.toISOString(),
                    messages: chatMessages.map(msg => ({
                      text: msg.text,
                      sender: msg.sender,
                      timestamp_ms: msg.timestampMs,
                      participant_id: msg.participantId
                    }))
                  },
                  score_data: {
                    final_score: scoreData.final_score,
                    tier: scoreData.tier,
                    pre_deduction_total: scoreData.pre_deduction_total,
                    raw_scores: {
                      opening_rapport: scoreData.raw_scores.opening_rapport,
                      discovery_qualification: scoreData.raw_scores.discovery_qualification,
                      value_messaging: scoreData.raw_scores.value_messaging,
                      objection_handling: scoreData.raw_scores.objection_handling,
                      trial_advancement: scoreData.raw_scores.trial_advancement,
                      listening_adaptability: scoreData.raw_scores.listening_adaptability,
                      professionalism: scoreData.raw_scores.professionalism
                    },
                    weighted_points: {
                      opening_rapport: scoreData.weighted_points.opening_rapport,
                      discovery_qualification: scoreData.weighted_points.discovery_qualification,
                      value_messaging: scoreData.weighted_points.value_messaging,
                      objection_handling: scoreData.weighted_points.objection_handling,
                      trial_advancement: scoreData.weighted_points.trial_advancement,
                      listening_adaptability: scoreData.weighted_points.listening_adaptability,
                      professionalism: scoreData.weighted_points.professionalism
                    },
                    deductions: scoreData.deductions,
                    strengths: scoreData.strengths,
                    coaching_items: scoreData.coaching_items,
                    detailed_feedback: scoreData.detailed_feedback
                  }
                })
              });
              
              if (saveResponse.ok) {
                console.log('✅ Conversation saved to database');
              } else {
                console.error('Failed to save conversation:', await saveResponse.text());
              }
            } catch (saveError) {
              console.error('Error saving conversation:', saveError);
              // Don't block exit if save fails
            }
            
            setIsCalculatingScore(false);
            return; // Exit early - cleanup happens when modal closes
          } else {
            const errorData = await scoreResponse.json().catch(() => ({}));
            console.error('Failed to calculate score:', errorData);
            updateStatus('Score calculation failed - continuing with exit');
          }
        } catch (error) {
          console.error('Error calculating score:', error);
          updateStatus('Score calculation error - continuing with exit');
        } finally {
          setIsCalculatingScore(false);
        }
      }
      
      // If no messages or scoring failed, proceed with normal cleanup
      await performCleanup();
    } catch (error) {
      console.error('Error during exit:', error);
      await performCleanup();
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

  /**
   * Interview Score Modal Component
   * Displays detailed scoring results in a comprehensive modal
   */
  const ScoreModal = () => {
    if (!showScoreModal || !interviewScore) return null;
    
    const { 
      raw_scores, 
      weighted_points, 
      pre_deduction_total, 
      deductions,
      final_score,
      tier,
      strengths,
      coaching_items,
      detailed_feedback
    } = interviewScore;
    
    // Calculate color based on score tier
    const getTierColor = () => {
      if (tier === "Excellent") return '#4ade80'; // Green
      if (tier === "Strong") return '#60a5fa'; // Blue
      if (tier === "Developing") return '#fbbf24'; // Yellow
      return '#f87171'; // Red
    };
    
    const tierColor = getTierColor();
    
    // Category labels and weights
    const categories = [
      { 
        key: 'opening_rapport', 
        label: 'Opening & Rapport', 
        weight: '10%',
        max: 10,
        color: '#3b82f6'
      },
      { 
        key: 'discovery_qualification', 
        label: 'Discovery & Qualification', 
        weight: '20%',
        max: 20,
        color: '#8b5cf6'
      },
      { 
        key: 'value_messaging', 
        label: 'Value Messaging & Positioning', 
        weight: '20%',
        max: 20,
        color: '#ec4899'
      },
      { 
        key: 'objection_handling', 
        label: 'Objection Handling', 
        weight: '20%',
        max: 20,
        color: '#f59e0b'
      },
      { 
        key: 'trial_advancement', 
        label: 'Trial Advancement & Closing', 
        weight: '15%',
        max: 15,
        color: '#10b981'
      },
      { 
        key: 'listening_adaptability', 
        label: 'Listening, Adaptability & Flow', 
        weight: '10%',
        max: 10,
        color: '#06b6d4'
      },
      { 
        key: 'professionalism', 
        label: 'Professionalism & Brand', 
        weight: '5%',
        max: 5,
        color: '#6366f1'
      }
    ];
    
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20000,
          padding: '20px',
          overflow: 'auto'
        }}
        onClick={handleCloseScoreModal}
      >
        <div
          style={{
            backgroundColor: '#1e293b',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '95vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            border: `3px solid ${tierColor}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '32px',
            borderBottom: '2px solid #334155',
            paddingBottom: '20px'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                color: '#f1f5f9', 
                fontSize: '28px', 
                fontWeight: '700',
                marginBottom: '8px'
              }}>
                📊 Interview Performance Score
              </h2>
              <p style={{ 
                margin: 0, 
                color: '#94a3b8', 
                fontSize: '14px' 
              }}>
                Sales Performance Evaluation
              </p>
            </div>
            <button
              onClick={handleCloseScoreModal}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '32px',
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                lineHeight: '1',
                transition: 'all 0.2s'
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
          
          {/* Overall Score Card */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            padding: '32px',
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            border: `4px solid ${tierColor}`
          }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#94a3b8', 
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Final Score
            </div>
            <div style={{
              fontSize: '96px',
              fontWeight: '800',
              color: tierColor,
              lineHeight: '1',
              marginBottom: '8px'
            }}>
              {Math.round(final_score)}
            </div>
            <div style={{ 
              fontSize: '36px', 
              color: '#64748b',
              marginBottom: '16px'
            }}>
              / 100
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: tierColor,
              padding: '12px 24px',
              backgroundColor: `${tierColor}20`,
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              {tier}
            </div>
            {tier === "Excellent" && (
              <div style={{ color: '#4ade80', marginTop: '12px', fontSize: '14px' }}>
                ✅ Ready for live selling
              </div>
            )}
            {tier === "Strong" && (
              <div style={{ color: '#60a5fa', marginTop: '12px', fontSize: '14px' }}>
                💪 Continue refinement
              </div>
            )}
            {tier === "Developing" && (
              <div style={{ color: '#fbbf24', marginTop: '12px', fontSize: '14px' }}>
                📈 Coaching recommended
              </div>
            )}
            {tier === "Not ready" && (
              <div style={{ color: '#f87171', marginTop: '12px', fontSize: '14px' }}>
                ⚠️ Repeat simulator sessions
              </div>
            )}
          </div>
          
          {/* Score Breakdown */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ 
              color: '#f1f5f9', 
              marginBottom: '24px', 
              fontSize: '20px',
              fontWeight: '600',
              borderBottom: '2px solid #334155',
              paddingBottom: '12px'
            }}>
              📋 Detailed Score Breakdown
            </h3>
            
            {categories.map((category) => {
              const rawScore = raw_scores[category.key];
              const weightedPoint = weighted_points[category.key];
              const percentage = (weightedPoint / category.max * 100).toFixed(1);
              
              return (
                <div 
                  key={category.key} 
                  style={{ 
                    marginBottom: '24px',
                    padding: '20px',
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: '1px solid #334155'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '4px'
                      }}>
                        <span style={{ 
                          color: '#f1f5f9', 
                          fontSize: '16px', 
                          fontWeight: '600'
                        }}>
                          {category.label}
                        </span>
                        <span style={{ 
                          color: '#64748b', 
                          fontSize: '12px',
                          backgroundColor: '#1e293b',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {category.weight}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        marginTop: '8px'
                      }}>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Raw Score: </span>
                          <span style={{ 
                            color: category.color, 
                            fontWeight: '700',
                            fontSize: '18px'
                          }}>
                            {rawScore}/5
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Weighted: </span>
                          <span style={{ 
                            color: '#f1f5f9', 
                            fontWeight: '700',
                            fontSize: '18px'
                          }}>
                            {weightedPoint}/{category.max} points
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Percentage: </span>
                          <span style={{ 
                            color: '#cbd5e1', 
                            fontWeight: '600'
                          }}>
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{
                    height: '12px',
                    backgroundColor: '#334155',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    marginTop: '12px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${percentage}%`,
                      backgroundColor: category.color,
                      transition: 'width 0.5s ease',
                      borderRadius: '6px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pre-Deduction Total */}
          <div style={{
            marginBottom: '24px',
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            borderRadius: '12px',
            border: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: '#cbd5e1', fontSize: '16px', fontWeight: '600' }}>
              Pre-Deduction Total:
            </span>
            <span style={{ 
              color: '#f1f5f9', 
              fontSize: '20px', 
              fontWeight: '700'
            }}>
              {pre_deduction_total.toFixed(1)} / 100
            </span>
          </div>
          
          {/* Deductions */}
          {deductions && deductions.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                color: '#f87171', 
                marginBottom: '16px', 
                fontSize: '20px',
                fontWeight: '600',
                borderBottom: '2px solid #334155',
                paddingBottom: '12px'
              }}>
                ⚠️ Deductions Applied
              </h3>
              {deductions.map((deduction, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '16px',
                    backgroundColor: '#7f1d1d20',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    borderLeft: '4px solid #f87171',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: '#fca5a5', fontSize: '14px', flex: 1 }}>
                    {deduction.reason}
                  </span>
                  <span style={{ 
                    color: '#f87171', 
                    fontSize: '18px', 
                    fontWeight: '700',
                    marginLeft: '16px'
                  }}>
                    {deduction.points} points
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {/* Detailed Feedback */}
          {detailed_feedback && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                color: '#f1f5f9', 
                marginBottom: '16px', 
                fontSize: '20px',
                fontWeight: '600',
                borderBottom: '2px solid #334155',
                paddingBottom: '12px'
              }}>
                💬 Detailed Feedback
              </h3>
              <div style={{
                padding: '20px',
                backgroundColor: '#0f172a',
                borderRadius: '12px',
                border: '1px solid #334155'
              }}>
                <p style={{ 
                  color: '#cbd5e1', 
                  lineHeight: '1.8', 
                  fontSize: '15px',
                  margin: 0
                }}>
                  {detailed_feedback}
                </p>
              </div>
            </div>
          )}
          
          {/* Strengths */}
          {strengths && strengths.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                color: '#4ade80', 
                marginBottom: '16px', 
                fontSize: '20px',
                fontWeight: '600',
                borderBottom: '2px solid #334155',
                paddingBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>✅</span>
                <span>Strengths</span>
              </h3>
              <div style={{
                padding: '20px',
                backgroundColor: '#064e3b20',
                borderRadius: '12px',
                border: '1px solid #4ade80'
              }}>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '24px', 
                  color: '#cbd5e1',
                  listStyle: 'none'
                }}>
                  {strengths.map((strength, idx) => (
                    <li 
                      key={idx} 
                      style={{ 
                        marginBottom: '12px',
                        fontSize: '15px',
                        lineHeight: '1.6',
                        paddingLeft: '8px',
                        position: 'relative'
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        left: '-20px',
                        color: '#4ade80',
                        fontWeight: '700'
                      }}>✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Coaching Items */}
          {coaching_items && coaching_items.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                color: '#fbbf24', 
                marginBottom: '16px', 
                fontSize: '20px',
                fontWeight: '600',
                borderBottom: '2px solid #334155',
                paddingBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>📈</span>
                <span>Areas for Improvement</span>
              </h3>
              <div style={{
                padding: '20px',
                backgroundColor: '#78350f20',
                borderRadius: '12px',
                border: '1px solid #fbbf24'
              }}>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '24px', 
                  color: '#cbd5e1',
                  listStyle: 'none'
                }}>
                  {coaching_items.map((item, idx) => (
                    <li 
                      key={idx} 
                      style={{ 
                        marginBottom: '12px',
                        fontSize: '15px',
                        lineHeight: '1.6',
                        paddingLeft: '8px',
                        position: 'relative'
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        left: '-20px',
                        color: '#fbbf24',
                        fontWeight: '700'
                      }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Close Button */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '2px solid #334155'
          }}>
            <button
              onClick={handleCloseScoreModal}
              style={{
                flex: 1,
                padding: '16px 32px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#2563eb';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
              }}
            >
              Close & Exit Interview
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="interview-container">
      <TranscriptionHandler />
      <ScoreModal />

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
