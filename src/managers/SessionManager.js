/**
 * Session Manager Class
 * Manages streaming session lifecycle and state
 */
import { heygenService } from '../services/HeyGenService';
import { openaiService } from '../services/OpenAIService';
import { WebRTCManager } from './WebRTCManager';

export class SessionManager {
  constructor() {
    this.sessionInfo = null;
    this.webRTCManager = null;
    this.isConnected = false;
  }

  /**
   * Create a new streaming session
   * @param {string} avatarId - Avatar ID
   * @param {string} voiceId - Voice ID
   * @param {string} quality - Video quality (default: 'low')
   * @returns {Promise<Object>} Session info and peer connection
   */
  async createSession(avatarId, voiceId, quality = 'low') {
    const session = await heygenService.createSession(quality, avatarId, voiceId);
    const { sdp: serverSdp, ice_servers2: iceServers } = session;

    this.webRTCManager = new WebRTCManager(iceServers);
    const peerConnection = this.webRTCManager.createPeerConnection();

    await this.webRTCManager.setRemoteDescription(serverSdp);

    this.sessionInfo = session;
    this.isConnected = false;

    return {
      session,
      peerConnection,
    };
  }

  /**
   * Start the streaming session
   * @param {Function} onTrack - Callback for track events
   * @param {Function} onDataChannel - Callback for data channel events
   * @param {Function} onIceCandidate - Callback for ICE candidates
   * @returns {Promise<void>}
   */
  async startSession(onTrack, onDataChannel, onIceCandidate) {
    if (!this.sessionInfo || !this.webRTCManager) {
      throw new Error('Please create a connection first');
    }

    const peerConnection = this.webRTCManager.getPeerConnection();

    // Set up event handlers
    if (onTrack) {
      peerConnection.ontrack = onTrack;
    }

    if (onDataChannel) {
      peerConnection.ondatachannel = onDataChannel;
    }

    // Set up ICE candidate handler BEFORE creating answer
    if (onIceCandidate) {
      this.webRTCManager.setupIceCandidateHandler((candidate) => {
        onIceCandidate(this.sessionInfo.session_id, candidate.toJSON());
      });
    }

    // Create and set local answer (this triggers ICE candidate gathering)
    // The SDP already contains initial ICE candidates, so we send it immediately
    const localDescription = await this.webRTCManager.createAnswer();

    // Send SDP to server immediately (don't wait for all ICE candidates)
    // ICE candidates will continue to be sent as they arrive
    await heygenService.startSession(this.sessionInfo.session_id, localDescription);

    // Configure jitter buffer
    this.webRTCManager.configureJitterBuffer(500);

    this.isConnected = true;
  }

  /**
   * Send a task (text) to the avatar
   * @param {string} text - Text to speak
   * @returns {Promise<Object>} Task response
   */
  async sendTask(text) {
    if (!this.sessionInfo) {
      throw new Error('Please create a connection first');
    }
    return await heygenService.sendTask(this.sessionInfo.session_id, text);
  }

  /**
   * Talk to AI and send response to avatar
   * @param {string} prompt - Prompt for AI
   * @returns {Promise<Object>} Task response
   */
  async talkToAI(prompt) {
    if (!this.sessionInfo) {
      throw new Error('Please create a connection first');
    }
    const text = await openaiService.complete(prompt);
    if (text) {
      return await heygenService.sendTask(this.sessionInfo.session_id, text);
    }
    throw new Error('Failed to get a response from AI');
  }

  /**
   * Close the session
   * @returns {Promise<void>}
   */
  async closeSession() {
    if (!this.sessionInfo || !this.webRTCManager) {
      return;
    }

    this.webRTCManager.close();
    await heygenService.stopSession(this.sessionInfo.session_id);
    
    this.sessionInfo = null;
    this.webRTCManager = null;
    this.isConnected = false;
  }

  getPeerConnection() {
    return this.webRTCManager?.getPeerConnection() || null;
  }
}

