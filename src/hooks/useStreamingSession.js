/**
 * Custom Hook for Streaming Session Management
 * Uses SessionManager class for session operations
 * 
 * @returns {Object} Session management functions and state
 * @returns {Object|null} returns.sessionInfo - Current session information
 * @returns {RTCPeerConnection|null} returns.peerConnection - WebRTC peer connection
 * @returns {boolean} returns.isConnected - Connection status
 * @returns {Function} returns.createNewSession - Create a new streaming session
 * @returns {Function} returns.startSession - Start the streaming session
 * @returns {Function} returns.sendTask - Send text task to avatar
 * @returns {Function} returns.closeSession - Close the current session
 */
import { useState, useRef, useCallback } from 'react';
import { SessionManager } from '../managers/SessionManager';
import { heygenService } from '../services/HeyGenService';

export function useStreamingSession() {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const sessionManagerRef = useRef(new SessionManager());

  /**
   * Create a new streaming session
   * @param {string} avatarId - Avatar ID
   * @param {string} voiceId - Voice ID
   * @param {string} quality - Video quality ('low', 'medium', 'high')
   * @returns {Promise<Object>} Session info and peer connection
   */
  const createNewSession = useCallback(async (avatarId, voiceId, quality = 'low') => {
    const result = await sessionManagerRef.current.createSession(
      avatarId,
      voiceId,
      quality
    );
    
    const { session, peerConnection: pc } = result;
    
    setPeerConnection(pc);
    setSessionInfo(session);
    setIsConnected(false);

    return { session, peerConnection: pc };
  }, []);

  /**
   * Start the streaming session
   * @param {Function|null} onTrack - Callback for track events
   * @param {Function|null} onDataChannel - Callback for data channel events
   * @returns {Promise<void>}
   */
  const startSession = useCallback(async (onTrack, onDataChannel) => {
    const onIceCandidate = (sessionId, candidate) => {
      heygenService.submitIceCandidate(sessionId, candidate);
    };

    await sessionManagerRef.current.startSession(onTrack, onDataChannel, onIceCandidate);
    setIsConnected(true);
  }, []);

  /**
   * Send a text task to the avatar
   * @param {string} text - Text to speak
   * @returns {Promise<Object>} Task response
   */
  const sendTask = useCallback(async (text) => {
    return await sessionManagerRef.current.sendTask(text);
  }, []);

  /**
   * Close the current session
   * @returns {Promise<void>}
   */
  const closeSession = useCallback(async () => {
    await sessionManagerRef.current.closeSession();
    setPeerConnection(null);
    setSessionInfo(null);
    setIsConnected(false);
  }, []);

  return {
    sessionInfo,
    peerConnection,
    isConnected,
    createNewSession,
    startSession,
    sendTask,
    closeSession,
  };
}
