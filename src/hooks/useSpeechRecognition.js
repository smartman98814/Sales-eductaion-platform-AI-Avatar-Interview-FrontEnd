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

  /**
   * Initialize speech recognition
   */
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser');
      return;
    }

    setIsSupported(true);

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true; // Show interim results for real-time feedback
    recognition.lang = 'en-US'; // Language
    recognition.maxAlternatives = 1; // Only one result

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
        if (onTranscriptComplete) {
          onTranscriptComplete(finalText);
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
      setIsListening(false);
      
      // Auto-restart if autoStart is enabled
      if (autoStartRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch (err) {
            console.log('Could not restart recognition:', err);
          }
        }, 300);
      }
    };

    // Handle errors
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Ignore 'no-speech' and 'aborted' errors (normal behavior)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
      
      // Don't restart on certain errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        autoStartRef.current = false;
        setIsListening(false);
      }
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
        recognitionRef.current.abort();
      }
    };
  }, [onTranscriptComplete]);

  /**
   * Start listening (continuous mode)
   */
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition not available');
      return;
    }

    try {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      autoStartRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(err.message);
      setIsListening(false);
    }
  }, [isSupported]);

  /**
   * Stop listening (disable continuous mode)
   */
  const stopListening = useCallback(() => {
    autoStartRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
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

