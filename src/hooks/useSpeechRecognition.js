/**
 * Speech Recognition Hook
 * Handles voice input using Web Speech API
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
    };
  }, []); // Empty dependency array - only run once on mount

  /**
   * Start listening (continuous mode)
   */
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition not available');
      console.error('Speech recognition not available:', { isSupported, hasRecognition: !!recognitionRef.current });
      return;
    }

    try {
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

