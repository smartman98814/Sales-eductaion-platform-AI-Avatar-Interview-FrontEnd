/**
 * Interview View Component
 * Zoom-like interview interface with avatar and interviewer webcam
 * Receives pre-initialized HeyGen session from parent
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { livekitService } from '../services/LiveKitService';
import { RoomEvent, Track } from 'livekit-client';
import { RoomContext, useVoiceAssistant, useTrackTranscription } from '@livekit/components-react';
import { useLocalMicTrack } from '../hooks/useLocalMicTrack';
import '../styles/interviewView.css';
import '../styles/chatWindow.css';

// Component that listens to both user and agent transcriptions
function TranscriptionListener({ addAgentMessageToChat, addUserMessageToChat, sendTaskToHeyGen }) {
  const { agentTranscriptions } = useVoiceAssistant();
  const micTrackRef = useLocalMicTrack();
  const { segments: userTranscriptions } = useTrackTranscription(micTrackRef);
  
  const lastProcessedAgentIndexRef = useRef(-1);
  const lastProcessedUserIndexRef = useRef(-1);
  const lastSentTextRef = useRef('');
  
  // Add user transcriptions to chat when they arrive
  useEffect(() => {
    if (userTranscriptions && userTranscriptions.length > 0) {
      const newTranscriptions = userTranscriptions.slice(lastProcessedUserIndexRef.current + 1);
      
      if (newTranscriptions.length > 0) {
        // Get the latest user transcription
        const latestTranscription = userTranscriptions[userTranscriptions.length - 1];
        
        if (latestTranscription && latestTranscription.text && latestTranscription.text.trim()) {
          const transcriptionText = latestTranscription.text.trim();
          
          // Add user message to chat (update in place if continuation)
          addUserMessageToChat(transcriptionText, { identity: 'user' }, true);
        }
        
        lastProcessedUserIndexRef.current = userTranscriptions.length - 1;
      }
    }
  }, [userTranscriptions, addUserMessageToChat]);
  
  // Add agent transcriptions to chat when they arrive
  useEffect(() => {
    if (agentTranscriptions && agentTranscriptions.length > 0) {
      // Process only new transcriptions (ones we haven't seen yet)
      const newTranscriptions = agentTranscriptions.slice(lastProcessedAgentIndexRef.current + 1);
      
      if (newTranscriptions.length > 0) {
        // Always use the latest transcription (last in array)
        // This ensures we get the most complete version as chunks arrive
        const latestTranscription = agentTranscriptions[agentTranscriptions.length - 1];
        
        if (latestTranscription && latestTranscription.text && latestTranscription.text.trim()) {
          const transcriptionText = latestTranscription.text.trim();
          
          // Always treat transcriptions as updates (they build progressively)
          // The addAgentMessageToChat function will determine if it's a continuation
          // and update the last message or create a new one
          addAgentMessageToChat(transcriptionText, { identity: 'agent' }, true);
          
          // Send to HeyGen when we have a complete sentence (ends with punctuation)
          // Only send if text has changed significantly (not just a continuation)
          const isCompleteSentence = /[.!?]\s*$/.test(transcriptionText);
          const isNewSentence = !transcriptionText.startsWith(lastSentTextRef.current) || 
                                transcriptionText.length - lastSentTextRef.current.length > 50;
          
          if (sendTaskToHeyGen && (isCompleteSentence || isNewSentence)) {
            // Send complete text to HeyGen for lip-synced video
            // Video will stream directly to frontend via original HeyGen WebRTC connection
            sendTaskToHeyGen(transcriptionText)
              .then(() => {
                console.log('✅ Sent agent response to HeyGen for lip-sync:', transcriptionText);
              })
              .catch(error => {
                console.error('Error sending text to HeyGen:', error);
              });
            
            lastSentTextRef.current = transcriptionText;
          }
        }
        
        // Update the last processed index to the latest
        lastProcessedAgentIndexRef.current = agentTranscriptions.length - 1;
      }
    }
  }, [agentTranscriptions, addAgentMessageToChat, sendTaskToHeyGen]);
  
  return null; // This component just handles transcriptions
}

export function InterviewView({ 
  avatar, 
  peerConnection,
  isConnected,
  livekitRoom,
  sendTaskToHeyGen, // Function to send text to HeyGen
  onExit 
}) {
  const [statusMessages, setStatusMessages] = useState([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [livekitConnected, setLivekitConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Webcam for interviewer
  const {
    videoRef: webcamRef,
    isActive: webcamActive,
    startWebcam,
    stopWebcam,
  } = useWebcam();



  // Video ref for HeyGen avatar (video only)
  const avatarVideoRef = useRef(null);
  // Audio element for LiveKit agent audio
  const livekitAudioRef = useRef(null);
  const roomRef = useRef(null);

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
   * Setup HeyGen video connection (video only, audio muted)
   */
  useEffect(() => {
    if (!peerConnection) {
      updateStatus('Waiting for HeyGen peer connection...');
      return;
    }
    
    if (!avatarVideoRef.current) {
      return;
    }
    
    console.log('Setting up HeyGen video connection');
    
    const videoElement = avatarVideoRef.current;
    // Mute HeyGen audio - we'll use LiveKit audio instead
    videoElement.muted = true;
    videoElement.volume = 0;
    
    // Check for existing tracks
    const checkExistingTracks = () => {
      try {
        const receivers = peerConnection.getReceivers();
        const videoTracks = [];
        
        for (const receiver of receivers) {
          if (receiver.track && receiver.track.kind === 'video') {
            videoTracks.push(receiver.track);
          }
        }
        
        if (videoTracks.length > 0) {
          const stream = new MediaStream(videoTracks);
          videoElement.srcObject = stream;
          updateStatus('HeyGen video connected ✓');
          videoElement.play().catch(err => console.log('Play error:', err));
          return true;
        }
      } catch (error) {
        console.error('Error checking existing tracks:', error);
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
        stream.getVideoTracks().forEach(t => stream.removeTrack(t));
        stream.addTrack(event.track);
        updateStatus('HeyGen video track connected ✓');
        videoElement.play().catch(err => console.log('Play error:', err));
      }
    };

    if (!hasExistingTrack) {
      updateStatus('Waiting for HeyGen video stream...');
    }
  }, [peerConnection, updateStatus]);

  /**
   * Enable audio playback (for LiveKit agent audio)
   */
  const handleEnableAudio = useCallback(async () => {
    if (!livekitRoom) {
      updateStatus('⚠️ Not connected to LiveKit room');
      return;
    }

    // Create audio element if it doesn't exist
    let audioElement = livekitAudioRef.current;
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElement.muted = false;
      audioElement.volume = 1.0;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
      livekitAudioRef.current = audioElement;
      console.log('✅ Created LiveKit audio element');
    }

    // Check for existing audio tracks and subscribe/attach them
    let foundTrack = false;
    livekitRoom.remoteParticipants.forEach((participant) => {
      if (participant.audioTracks && participant.audioTracks.forEach) {
        participant.audioTracks.forEach((publication) => {
          // Subscribe to the track if not already subscribed
          if (publication && !publication.isSubscribed) {
            console.log('📡 Subscribing to audio track from:', participant.identity);
            try {
              // Use setSubscribed to subscribe to the track
              // LiveKit tracks auto-subscribe by default, but we ensure it's subscribed
              publication.setSubscribed(true);
              console.log('✅ Subscription request sent for audio track');
            } catch (error) {
              console.error('Error subscribing to track:', error);
            }
          }
          
          // If track is available, attach it
          if (publication.track) {
            foundTrack = true;
            console.log('🔊 Found audio track from:', participant.identity);
            
            // Attach track to audio element
            try {
              publication.track.attach(audioElement);
              console.log('✅ Attached audio track to element');
              
              // Ensure audio element is ready
              audioElement.muted = false;
              audioElement.volume = 1.0;
            } catch (error) {
              console.error('Error attaching track:', error);
            }
          } else if (publication.isSubscribed) {
            // Track is subscribed but not ready yet - will be handled by TrackSubscribed event
            console.log('⏳ Audio track subscribed but not ready yet from:', participant.identity);
            foundTrack = true; // Mark as found so we set up audio element
          }
        });
      }
    });

    if (foundTrack) {
      // Try to play the audio
      try {
        audioElement.muted = false;
        audioElement.volume = 1.0;
        
        // Add event listeners to debug audio playback
        audioElement.addEventListener('play', () => {
          console.log('▶️ Audio element started playing');
        });
        
        audioElement.addEventListener('pause', () => {
          console.log('⏸️ Audio element paused');
        });
        
        audioElement.addEventListener('ended', () => {
          console.log('⏹️ Audio element ended');
        });
        
        audioElement.addEventListener('error', (e) => {
          console.error('❌ Audio element error:', e);
        });
        
        // Check if audio element has a source
        if (audioElement.srcObject || audioElement.src) {
          console.log('✅ Audio element has source');
        } else {
          console.warn('⚠️ Audio element has no source yet');
        }
        
        await audioElement.play();
        setAudioEnabled(true);
        updateStatus('🔊 Agent audio enabled ✓');
        console.log('✅ LiveKit agent audio playing');
        
        // Log audio element state
        console.log('Audio element state:', {
          muted: audioElement.muted,
          volume: audioElement.volume,
          paused: audioElement.paused,
          readyState: audioElement.readyState,
          currentTime: audioElement.currentTime
        });
      } catch (error) {
        console.error('❌ Error playing audio:', error);
        updateStatus('⚠️ Audio ready - will play when agent speaks');
        // Still mark as enabled since track is attached
        setAudioEnabled(true);
      }
    } else {
      updateStatus('⚠️ No audio tracks yet - waiting for agent to send audio');
      console.warn('⚠️ No audio tracks found - agent may not be sending audio yet');
      // Don't set audioEnabled to true yet - wait for track to arrive
    }
  }, [livekitRoom, updateStatus]);

  
  /**
   * Send text message via LiveKit data channel
   */
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim() || !livekitRoom) return;
    
    try {
      // Add user message to chat with unique ID to prevent duplicates across multiple PCs
      const messageHash = `${livekitRoom.localParticipant?.identity || 'user'}-${message}-${Date.now()}`;
      const messageId = btoa(messageHash).substring(0, 16);
      
      const userMessage = {
        id: messageId,
        text: message,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString(),
        participantId: livekitRoom.localParticipant?.identity || 'user',
      };
      
      // Prevent duplicates when running on multiple PCs
      setChatMessages(prev => {
        const isDuplicate = prev.some(msg => 
          msg.text === message && 
          msg.sender === 'user' &&
          msg.participantId === livekitRoom.localParticipant?.identity &&
          Math.abs(new Date().getTime() - new Date(msg.timestamp).getTime()) < 2000
        );
        if (isDuplicate) {
          console.log('⚠️ Duplicate user message detected, skipping');
          return prev;
        }
        return [...prev, userMessage];
      });
      
      setChatInput('');
      
      // Send via LiveKit text stream (preferred method for agent communication)
      if (livekitRoom.localParticipant) {
        try {
          // Use sendText() with 'lk.chat' topic - this is the standard way agents receive text
          await livekitRoom.localParticipant.sendText(message, {
            topic: 'lk.chat',
          });
          
          console.log('✅ Text message sent via sendText() with topic lk.chat:', message);
          console.log('Room participants:', {
            local: livekitRoom.localParticipant?.identity,
            remote: livekitRoom.remoteParticipants.size,
            remoteList: Array.from(livekitRoom.remoteParticipants.values()).map(p => p.identity)
          });
          updateStatus(`Sent: ${message}`);
          
          // If no remote participants, warn the user
          if (livekitRoom.remoteParticipants.size === 0) {
            console.warn('⚠️ Message sent but no agent is connected to receive it!');
            updateStatus('⚠️ Message sent, but no agent connected to room');
          } else {
            console.log('✅ Agent is connected - waiting for response...');
          }
        } catch (error) {
          console.error('Error sending text via sendText(), trying publishData() as fallback:', error);
          // Fallback to publishData if sendText fails
          try {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify({
              type: 'text_message',
              text: message,
              timestamp: Date.now(),
            }));
            await livekitRoom.localParticipant.publishData(data, { reliable: true });
            console.log('✅ Message sent via publishData() fallback');
            updateStatus(`Sent: ${message}`);
          } catch (fallbackError) {
            console.error('Error sending message:', fallbackError);
            updateStatus(`Error sending message: ${fallbackError.message}`);
          }
        }
      } else {
        console.error('No local participant available');
        updateStatus('Error: Not connected to LiveKit room');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      updateStatus(`Error sending message: ${error.message}`);
    }
  }, [livekitRoom, updateStatus]);

  /**
   * Start the conversation
   */
  const handleStartConversation = async () => {
    try {
      setConversationStarted(true);
      updateStatus('Starting conversation with LiveKit agent...');
      
      // Enable audio first
      await handleEnableAudio();
      
      // Publish local microphone if available
      if (roomRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          await livekitService.publishTracks(stream);
          updateStatus('Microphone connected - speak naturally!');
        } catch (error) {
          console.error('Error publishing microphone:', error);
          updateStatus('Microphone not available - agent can still hear you if enabled');
        }
      }
      
      updateStatus('Conversation started! Speak naturally to the agent.');
    } catch (error) {
      updateStatus(`Error: ${error.message}`);
    }
  };

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
      
      // Cleanup audio element
      if (livekitAudioRef.current) {
        livekitAudioRef.current.remove();
        livekitAudioRef.current = null;
      }
      
      stopWebcam();
      onExit();
    } catch (error) {
      console.error('Error exiting:', error);
      onExit();
    }
  };

  // Helper function to add or update user message to chat
  const addUserMessageToChat = useCallback((messageText, participant, isUpdate = false) => {
    if (!messageText || !messageText.trim()) return;
    
    setChatMessages(prev => {
      const trimmedText = messageText.trim();
      
      // Always try to update the last user message if it exists and this looks like a continuation
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].sender === 'user') {
        const lastMessage = prev[lastIndex];
        const lastText = lastMessage.text.trim();
        
        // Check if this is a continuation of the last message
        const isContinuation = 
          trimmedText.startsWith(lastText) ||  // New text starts with old text
          (lastText.length > 0 && trimmedText.length > lastText.length && 
           trimmedText.substring(0, lastText.length) === lastText); // New text extends old text
        
        if (isContinuation || isUpdate) {
          // Update the existing message in place
          const updated = [...prev];
          updated[lastIndex] = {
            ...lastMessage,
            text: trimmedText,
            timestamp: new Date().toLocaleTimeString(),
          };
          console.log('📝 Updating user message:', lastText, '->', trimmedText);
          return updated;
        }
      }
      
      // Check if this exact message already exists (prevent duplicates)
      const isDuplicate = prev.some(msg => 
        msg.text === trimmedText && 
        msg.sender === 'user'
      );
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate user message detected, skipping:', trimmedText);
        return prev;
      }
      
      // Create new message only if it's not a continuation
      const messageHash = `${participant?.identity || 'user'}-${trimmedText}-${Date.now()}`;
      const messageId = btoa(messageHash).substring(0, 16);
      
      const userMessage = {
        id: messageId,
        text: trimmedText,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString(),
        participantId: participant?.identity || 'user',
      };
      
      console.log('💬 Adding new user message to chat:', userMessage);
      return [...prev, userMessage];
    });
  }, []);

  // Helper function to add or update agent message to chat
  const addAgentMessageToChat = useCallback((messageText, participant, isUpdate = false) => {
    if (!messageText || !messageText.trim()) return;
    
    setChatMessages(prev => {
      const trimmedText = messageText.trim();
      
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
          // Update the existing message in place
          const updated = [...prev];
          updated[lastIndex] = {
            ...lastMessage,
            text: trimmedText,
            timestamp: new Date().toLocaleTimeString(),
          };
          console.log('📝 Updating agent message:', lastText, '->', trimmedText);
          return updated;
        }
      }
      
      // Check if this exact message already exists (prevent duplicates)
      const isDuplicate = prev.some(msg => 
        msg.text === trimmedText && 
        msg.sender === 'agent'
      );
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate message detected, skipping:', trimmedText);
        return prev;
      }
      
      // Create new message only if it's not a continuation
      const messageHash = `${participant?.identity || 'agent'}-${trimmedText}-${Date.now()}`;
      const messageId = btoa(messageHash).substring(0, 16);
      
      const agentMessage = {
        id: messageId,
        text: trimmedText,
        sender: 'agent',
        timestamp: new Date().toLocaleTimeString(),
        participantId: participant?.identity || 'agent',
      };
      
      console.log('💬 Adding new agent message to chat:', agentMessage);
      return [...prev, agentMessage];
    });
    
    updateStatus(`Agent: ${messageText}`);
  }, [updateStatus]);

  /**
   * Setup LiveKit data channel for text messages
   */
  useEffect(() => {
    if (!livekitRoom) return;

    console.log('Setting up LiveKit data channel listener...');
    console.log('Current remote participants:', livekitRoom.remoteParticipants.size);
    livekitRoom.remoteParticipants.forEach((p) => {
      console.log('  - Participant:', p.identity, p.sid);
    });

    // Handle data messages from LiveKit (text chat)
    const handleDataReceived = (payload, kind, participant, topic) => {
      console.log('📨 Data received from LiveKit:', {
        participant: participant?.identity,
        kind: kind,
        topic: topic,
        payloadLength: payload?.byteLength,
      });

      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        console.log('Decoded text:', text);
        
        let data;
        try {
          data = JSON.parse(text);
          console.log('Parsed JSON data:', data);
        } catch (e) {
          // If not JSON, treat as plain text
          console.log('Not JSON, treating as plain text');
          data = { text: text };
        }
        
        // Accept various message formats
        const messageText = data.text || data.message || data.content || data.transcript || text;
        
        if (messageText && messageText.trim()) {
          addAgentMessageToChat(messageText, participant);
        } else {
          console.log('No valid message text found in data:', data);
        }
      } catch (error) {
        console.error('Error processing data message:', error);
        // Try to display raw payload as text
        try {
          const decoder = new TextDecoder();
          const text = decoder.decode(payload);
          if (text.trim()) {
            addAgentMessageToChat(text, participant);
          }
        } catch (e) {
          console.error('Error decoding data message:', e);
        }
      }
    };

    // Listen for data at room level
    livekitRoom.on(RoomEvent.DataReceived, handleDataReceived);
    console.log('✅ Room-level data channel listener registered');
    
    // Also listen for data from remote participants
    const setupParticipantListeners = () => {
      livekitRoom.remoteParticipants.forEach((participant) => {
        console.log('Setting up listener for participant:', participant.identity);
        participant.on('dataReceived', handleDataReceived);
        console.log(`✅ Data channel listener registered for ${participant.identity}`);
      });
    };

    // Set up listeners for existing participants
    setupParticipantListeners();
    
    // Test: Send a test message to verify data channel works
    const testDataChannel = async () => {
      if (livekitRoom.localParticipant && livekitRoom.remoteParticipants.size > 0) {
        console.log('🧪 Testing data channel - sending test message...');
        try {
          const testData = new TextEncoder().encode(JSON.stringify({
            type: 'test',
            message: 'Data channel test from frontend'
          }));
          await livekitRoom.localParticipant.publishData(testData, { reliable: true });
          console.log('✅ Test message sent - data channel is working');
        } catch (error) {
          console.error('❌ Failed to send test message:', error);
        }
      }
    };
    
    // Test after a short delay to ensure connection is stable
    setTimeout(testDataChannel, 2000);

    // Set up listeners for new participants
    const handleParticipantConnected = (participant) => {
      console.log('✅ New participant connected:', {
        identity: participant.identity,
        sid: participant.sid,
        metadata: participant.metadata,
        isAgent: participant.identity?.includes('agent') || participant.identity?.includes('bot')
      });
      
      // Set up data channel listener for this participant
      participant.on('dataReceived', handleDataReceived);
      
      // Log all participant info
      console.log('Participant details:', {
        identity: participant.identity,
        sid: participant.sid,
        metadata: participant.metadata,
        audioTracks: participant.audioTracks.size,
        videoTracks: participant.videoTracks.size,
        dataTracks: participant.dataTracks.size,
      });
      
      // Check if agent is configured to send text messages
      if (participant.dataTracks.size === 0) {
        console.warn('⚠️ Agent has no data tracks - agent may not be configured to send text messages');
        console.warn('⚠️ LiveKit Cloud agents need to be configured to send text via publishData()');
        updateStatus('⚠️ Agent connected but may not send text messages. Check agent configuration.');
      } else {
        console.log('✅ Agent has data tracks - should be able to send text messages');
      }
      
      updateStatus(`Agent ${participant.identity} connected ✓`);
      
      // Auto-enable audio when agent connects (user already clicked to start interview)
      // This works because the user interaction happened when they clicked to start
      setTimeout(() => {
        handleEnableAudio().catch(err => {
          console.log('Auto-enable audio on participant connect failed:', err);
        });
      }, 300);
    };

    // Also listen for participant updates
    const handleParticipantDisconnected = (participant) => {
      console.log('❌ Participant disconnected:', participant.identity);
      updateStatus(`Agent ${participant.identity} disconnected`);
    };

    // Handle audio tracks from LiveKit agent
    const handleTrackSubscribed = (track, publication, participant) => {
      console.log('🎵 LiveKit track subscribed:', {
        kind: track.kind,
        source: track.source,
        participant: participant.identity,
        trackId: track.sid
      });

      if (track.kind === Track.Kind.Audio) {
        console.log('🔊 Audio track received from agent:', participant.identity);
        
        // Create or get audio element for LiveKit audio
        let audioElement = livekitAudioRef.current;
        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.autoplay = true;
          audioElement.muted = false;
          audioElement.volume = 1.0;
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          livekitAudioRef.current = audioElement;
          console.log('✅ Created LiveKit audio element');
        }

        // Ensure track is subscribed (should already be subscribed if TrackSubscribed fired)
        if (!publication.isSubscribed) {
          console.log('⚠️ TrackSubscribed fired but publication not marked as subscribed - subscribing now');
          try {
            publication.setSubscribed(true);
          } catch (error) {
            console.error('Error subscribing to track in handler:', error);
          }
        } else {
          console.log('✅ Track is already subscribed');
        }
        
        // Attach the audio track to the audio element
        try {
          // Detach any existing track first to avoid conflicts
          if (audioElement.srcObject) {
            const existingStream = audioElement.srcObject;
            existingStream.getAudioTracks().forEach(t => {
              t.stop();
              existingStream.removeTrack(t);
            });
          }
          
          track.attach(audioElement);
          console.log('✅ Attached audio track to audio element');
          
          // Log track details
          console.log('Audio track details:', {
            kind: track.kind,
            id: track.sid,
            muted: track.isMuted,
            enabled: track.isEnabled,
            state: track.mediaStreamTrack?.readyState
          });
          
          // Ensure audio element settings are correct
          audioElement.muted = false;
          audioElement.volume = 1.0;
          
          // Listen for track ended event to detect when audio stops
          track.on('ended', () => {
            console.log('🔇 Audio track ended');
          });
          
          // Listen for track muted/unmuted
          track.on('muted', () => {
            console.warn('🔇 Audio track muted');
            audioElement.muted = true;
          });
          
          track.on('unmuted', () => {
            console.log('🔊 Audio track unmuted');
            audioElement.muted = false;
          });
          
          // Listen for track enabled/disabled
          track.on('disabled', () => {
            console.warn('🔇 Audio track disabled');
          });
          
          track.on('enabled', () => {
            console.log('🔊 Audio track enabled');
          });
          
          // Check if the media stream track is ready
          if (track.mediaStreamTrack) {
            console.log('MediaStreamTrack state:', track.mediaStreamTrack.readyState);
            if (track.mediaStreamTrack.readyState === 'live') {
              console.log('✅ MediaStreamTrack is live');
            }
          }
        } catch (error) {
          console.error('Error attaching audio track:', error);
        }
        
        // Listen for transcription events (speech-to-text from agent)
        // Note: LiveKit transcriptions may come via data channel or text streams
        // The data channel handler above should capture most messages
        if (track.on) {
          track.on('transcriptionReceived', (transcription) => {
            console.log('📝 Transcription received from agent track:', transcription);
            if (transcription && transcription.text && transcription.text.trim()) {
              addAgentMessageToChat(transcription.text, participant);
            }
          });
        }
        
        // Try to play (browser may require user interaction)
        audioElement.muted = false;
        audioElement.volume = 1.0;
        
        // Force play with multiple attempts
        const playAudio = async () => {
          try {
            await audioElement.play();
            console.log('✅ LiveKit agent audio playing');
            updateStatus('🔊 Agent audio connected ✓');
            setAudioEnabled(true);
          } catch (error) {
            console.warn('⚠️ Auto-play blocked (browser requires user interaction):', error);
            // Try to enable audio automatically after a short delay
            // This works because the user already clicked to start the interview
            setTimeout(async () => {
              try {
                await audioElement.play();
                console.log('✅ LiveKit agent audio playing (retry)');
                setAudioEnabled(true);
                updateStatus('🔊 Agent audio connected ✓');
              } catch (retryError) {
                console.error('❌ Audio play failed after retry:', retryError);
                // If still blocked, show the enable button
                updateStatus('⚠️ Click avatar to enable agent audio');
              }
            }, 100);
          }
        };
        
        playAudio();
      }
    };

    // Subscribe to track events
    livekitRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    // Check for existing audio tracks from already-connected participants
    livekitRoom.remoteParticipants.forEach((participant) => {
      // Add null check for audioTracks
      if (participant.audioTracks && participant.audioTracks.forEach) {
        participant.audioTracks.forEach((publication) => {
          if (publication && publication.track) {
            console.log('Found existing audio track from:', participant.identity);
            handleTrackSubscribed(publication.track, publication, participant);
          }
        });
      }
    });

    livekitRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    livekitRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    
    // Log room state
    console.log('Room state:', {
      name: livekitRoom.name,
      localParticipant: livekitRoom.localParticipant?.identity,
      remoteParticipants: livekitRoom.remoteParticipants.size,
      state: livekitRoom.state,
    });
    
    // Log detailed connection info for debugging
    console.log('🔷 Room Name:', livekitRoom.name);
    console.log('🔷 Local Participant:', livekitRoom.localParticipant?.identity);
    console.log('🔷 Remote Participants:', livekitRoom.remoteParticipants.size);
    
    // List all participants
    livekitRoom.remoteParticipants.forEach((p) => {
      console.log(`🔷   - Remote: ${p.identity} (${p.sid})`);
      const isAgent = p.identity?.includes('agent') || p.identity?.includes('bot') || p.identity?.includes('Dakota');
      console.log(`🔷     Is Agent: ${isAgent ? '✅' : '❌'}`);
    });
    
    if (livekitRoom.remoteParticipants.size === 0) {
      console.warn('🔷 ⚠️ NO AGENT CONNECTED!');
      console.warn('🔷 Your session shows 1 participant (just you) in LiveKit Cloud.');
      console.warn('🔷 The agent "Dakota-1e0" needs to be configured to auto-join rooms.');
      console.warn('🔷');
      console.warn('🔷 TO FIX - Try these options:');
      console.warn('🔷');
      console.warn('🔷 OPTION 1: Check Agent Settings (Recommended)');
      console.warn('🔷 1. Go to: https://cloud.livekit.io → Agents → Dakota-1e0');
      console.warn('🔷 2. Check if agent status is "RUNNING"');
      console.warn('🔷 3. Look for "Settings" or "Configuration" tab');
      console.warn('🔷 4. Enable "Auto-join rooms" or set room pattern: room-avatar-*');
      console.warn('🔷');
      console.warn('🔷 OPTION 2: Agent Dispatch Rules');
      console.warn('🔷 1. Go to: Settings → Agent Dispatch (if available)');
      console.warn('🔷 2. Create rule: Agent "Dakota-1e0" joins rooms matching "room-avatar-*"');
      console.warn('🔷');
      console.warn('🔷 OPTION 3: Webhook (If agent settings don\'t work)');
      console.warn('🔷 1. Go to: Settings → Webhooks');
      console.warn('🔷 2. Create webhook pointing to your backend: /api/livekit/webhook');
      console.warn('🔷');
      console.warn('🔷 See LIVEKIT_AGENT_DEPLOYMENT.md for detailed instructions');
      
      // Update UI status
      updateStatus('⚠️ Agent not connected - check agent settings in LiveKit Cloud');
    } else {
      console.log('🔷 ✅ Agent is connected!');
      const agentParticipants = Array.from(livekitRoom.remoteParticipants.values()).filter(
        p => p.identity?.includes('agent') || p.identity?.includes('bot') || p.identity?.includes('Dakota')
      );
      if (agentParticipants.length > 0) {
        console.log(`🔷 ✅ Found ${agentParticipants.length} agent(s) in room`);
        agentParticipants.forEach(p => {
          console.log(`🔷   - Agent: ${p.identity}`);
        });
      }
    }
    
    setLivekitConnected(true);
    console.log('LiveKit data channel listener set up ✓');
    
    // Auto-enable audio when room is ready (user already clicked to start interview)
    // This works because the user interaction happened when they clicked to start
    if (livekitRoom.remoteParticipants.size > 0) {
      // Try to enable audio automatically after a short delay
      setTimeout(() => {
        handleEnableAudio().catch(err => {
          console.log('Auto-enable audio failed (will show button if needed):', err);
        });
      }, 500);
    }
    
    // Periodic check for participants (for debugging)
    const participantCheckInterval = setInterval(() => {
      const count = livekitRoom.remoteParticipants.size;
      if (count === 0) {
        console.warn('⚠️ No remote participants in room. Waiting for agent to join...');
      } else {
        console.log(`✓ ${count} remote participant(s) in room`);
        livekitRoom.remoteParticipants.forEach((p) => {
          console.log(`  - ${p.identity} (${p.sid})`);
        });
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(participantCheckInterval);
      livekitRoom.off(RoomEvent.DataReceived, handleDataReceived);
      livekitRoom.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      livekitRoom.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      livekitRoom.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      // Clean up participant listeners
      livekitRoom.remoteParticipants.forEach((participant) => {
        participant.off('dataReceived', handleDataReceived);
      });
      // Clean up audio element
      if (livekitAudioRef.current) {
        livekitAudioRef.current.remove();
        livekitAudioRef.current = null;
      }
    };
  }, [livekitRoom, updateStatus, addAgentMessageToChat, handleEnableAudio]);

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
        <TranscriptionListener 
          addAgentMessageToChat={addAgentMessageToChat}
          addUserMessageToChat={addUserMessageToChat}
          sendTaskToHeyGen={sendTaskToHeyGen}
        />
      </RoomContext.Provider>
    );
  };

  return (
    <div className="interview-container">
      <TranscriptionHandler />
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
          onClick={handleEnableAudio}
        />
        
        {/* Audio Enable Prompt - Show only if audio not enabled and agent is connected */}
        {!audioEnabled && livekitConnected && livekitRoom?.remoteParticipants.size > 0 && (
          <div className="audio-prompt">
            {/* {<button className="btn-enable-audio" onClick={handleEnableAudio}>
              🔊 Click to Enable Audio
            </button>} */}
            <p className="audio-hint">Or click the avatar video above</p>
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
          {chatMessages.length === 0 ? (
            <div className="chat-empty">
              <p>No messages yet.</p>
              <p className="chat-hint">Type a message or speak to the agent!</p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender === 'user' ? 'chat-message-user' : 'chat-message-agent'}`}>
                <div className="chat-message-header">
                  <span className="chat-message-sender">
                    {msg.sender === 'user' ? 'You' : avatar.fullName}
                  </span>
                  <span className="chat-message-time">{msg.timestamp}</span>
                </div>
                <div className="chat-message-text">{msg.text}</div>
              </div>
            ))
          )}
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder={livekitConnected ? "Type your message..." : "Connecting..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => {
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

