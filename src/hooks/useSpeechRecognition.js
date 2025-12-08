/**
 * Speech Recognition Hook
 * Handles voice input using Web Speech API
 * 
 * Browser's Built-in Echo Cancellation (AEC):
 * - Maintains an active MediaStream with echoCancellation: true
 * - This ensures browser's AEC is active at the system level
 * - Browser monitors speaker output (avatar's voice) and subtracts it from mic input
 * - Result: Only user's voice is captured, avatar's voice is filtered out
 * - This allows users to speak while avatar is speaking without echo loops
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeechRecognition({ onTranscriptComplete, autoStart = false } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const autoStartRef = useRef(autoStart);
  const callbackRef = useRef(onTranscriptComplete);
  const echoCancellationStreamRef = useRef(null); // Keep MediaStream active for system-level AEC
  
  // Update callback ref when it changes (without triggering useEffect)
  useEffect(() => {
    callbackRef.current = onTranscriptComplete;
  }, [onTranscriptComplete]);

  /**
   * Initialize speech recognition
   */
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      console.warn('Speech recognition not supported');
      return;
    }

    setIsSupported(true);
    console.log('Speech recognition is supported');

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true; // Show interim results for real-time feedback
    recognition.lang = 'en-US'; // Language
    recognition.maxAlternatives = 1; // Only one result
    
    console.log('Speech recognition instance created');

    // Handle results
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptText + ' ';
        } else {
          interim += transcriptText;
        }
      }

      // Update interim transcript for visual feedback
      if (interim) {
        setInterimTranscript(interim.trim());
      }

      // If we got a final result, trigger callback and prepare for next
      if (final.trim()) {
        const finalText = final.trim();
        console.log('Final transcript received:', finalText);
        setTranscript(finalText);
        setInterimTranscript('');
        
        // Callback with complete transcript
        if (callbackRef.current) {
          callbackRef.current(finalText);
        }
        
        // Reset transcript after callback
        setTimeout(() => {
          setTranscript('');
        }, 500);
      }
    };

    // Handle end - restart if needed
    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Auto-restart if autoStart is enabled
      if (autoStartRef.current) {
        console.log('Auto-restarting in 300ms...');
        // Keep isListening as true during restart delay to prevent UI flicker
        restartTimeoutRef.current = setTimeout(() => {
          try {
            console.log('Attempting to restart recognition...');
            recognition.start();
            // isListening should already be true, but set it just in case
            setIsListening(true);
            console.log('Recognition restarted successfully');
          } catch (err) {
            console.error('Could not restart recognition:', err);
            // Only set to false if restart failed
            setIsListening(false);
            autoStartRef.current = false;
          }
        }, 300);
        // Don't set isListening to false if we're auto-restarting
      } else {
        // Only set to false if we're not auto-restarting
        setIsListening(false);
      }
    };

    // Handle errors
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event);
      
      // Ignore 'no-speech' and 'aborted' errors (normal behavior)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
      
      // Don't restart on certain errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.log('Microphone permission denied, stopping auto-restart');
        autoStartRef.current = false;
        setIsListening(false);
      } else if (event.error === 'network' || event.error === 'service-unavailable') {
        console.log('Speech service unavailable, stopping auto-restart');
        autoStartRef.current = false;
        setIsListening(false);
      }
      // For other errors, let auto-restart continue if enabled
    };

    // Handle speech start
    recognition.onspeechstart = () => {
      console.log('Speech detected');
      setError(null);
    };

    // Handle speech end (pause detected)
    recognition.onspeechend = () => {
      console.log('Speech pause detected');
    };

    recognitionRef.current = recognition;

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        autoStartRef.current = false;
        try {
          recognitionRef.current.abort();
        } catch (err) {
          // Ignore errors when aborting during cleanup
        }
      }
      // Clean up echo cancellation stream
      if (echoCancellationStreamRef.current) {
        echoCancellationStreamRef.current.getTracks().forEach(track => track.stop());
        echoCancellationStreamRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  /**
   * Start listening (continuous mode)
   * Creates and maintains a MediaStream with echo cancellation to ensure
   * browser's AEC is active at system level, filtering avatar's voice from mic input
   */
  const startListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition not available');
      console.error('Speech recognition not available:', { isSupported, hasRecognition: !!recognitionRef.current });
      return;
    }

    try {
      // Request microphone with echo cancellation enabled
      // This ensures browser's AEC is active at system level
      if (!echoCancellationStreamRef.current) {
        console.log('Creating MediaStream with echo cancellation for system-level AEC...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,        // Removes speaker audio (avatar voice) from mic
              noiseSuppression: true,         // Removes background noise
              autoGainControl: true,          // Normalizes volume levels
              sampleRate: 48000              // Higher quality
            }
          });
          
          // Verify echo cancellation is active
          const audioTrack = stream.getAudioTracks()[0];
          const settings = audioTrack.getSettings();
          console.log('Echo cancellation stream created:', {
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
            autoGainControl: settings.autoGainControl
          });
          
          if (settings.echoCancellation) {
            console.log('✓ Browser echo cancellation is ACTIVE - avatar voice will be filtered');
          } else {
            console.warn('⚠ Echo cancellation may not be active');
          }
          
          // Keep stream active to maintain system-level AEC
          echoCancellationStreamRef.current = stream;
        } catch (streamErr) {
          console.warn('Could not create echo cancellation stream:', streamErr);
          // Continue anyway - browser may still apply AEC
        }
      }

      setTranscript('');
      setInterimTranscript('');
      setError(null);
      autoStartRef.current = true;
      setIsListening(true);
      console.log('Starting speech recognition...');
      
      // Check if recognition is already running
      if (recognitionRef.current && recognitionRef.current.state === 'running') {
        console.log('Recognition already running, stopping first...');
        try {
          recognitionRef.current.stop();
          // Wait a moment before restarting
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              console.log('Speech recognition restarted successfully');
            } catch (restartErr) {
              console.error('Error restarting recognition:', restartErr);
              setError(restartErr.message || 'Failed to restart speech recognition');
              setIsListening(false);
              autoStartRef.current = false;
            }
          }, 100);
        } catch (stopErr) {
          console.error('Error stopping recognition:', stopErr);
        }
      } else {
        recognitionRef.current.start();
        console.log('Speech recognition started successfully');
      }
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(err.message || 'Failed to start speech recognition');
      setIsListening(false);
      autoStartRef.current = false;
      
      // If it's a permission error, provide helpful message
      if (err.message && err.message.includes('not-allowed')) {
        setError('Microphone permission denied. Please allow microphone access and try again.');
      }
    }
  }, [isSupported]);

  /**
   * Stop listening (disable continuous mode)
   */
  const stopListening = useCallback(() => {
    console.log('Stopping speech recognition...');
    autoStartRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.log('Error stopping recognition (may already be stopped):', err);
      }
    }
    
    // Stop echo cancellation stream
    if (echoCancellationStreamRef.current) {
      console.log('Stopping echo cancellation stream...');
      echoCancellationStreamRef.current.getTracks().forEach(track => track.stop());
      echoCancellationStreamRef.current = null;
    }
    
    setIsListening(false);
    console.log('Speech recognition stopped');
  }, []);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}

