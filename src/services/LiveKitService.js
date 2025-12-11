/**
 * LiveKit Service
 * Handles LiveKit room connections and real-time audio/video
 */
import { Room, RoomEvent, Track } from 'livekit-client';
import { config } from '../config';
import { authService } from './AuthService';

export class LiveKitService {
  constructor() {
    this.baseUrl = config.backend.baseUrl;
    this.currentRoom = null;
  }

  /**
   * Get headers with authentication
   * @returns {Object} Headers object with auth token if available
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...authService.getAuthHeader(),
    };
  }

  /**
   * Create a LiveKit room token
   * @param {string} roomName - Name of the room
   * @param {string} participantName - Name of the participant
   * @param {number} agentId - Agent ID (1-10)
   * @returns {Promise<Object>} Token and connection info
   */
  async createRoomToken(roomName, participantName, agentId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/livekit/token`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          room_name: roomName,
          participant_name: participantName,
          agent_id: agentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`;
        throw new Error(`Failed to create room token: ${errorMsg}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating room token:', error);
      throw error;
    }
  }

  /**
   * Connect to a LiveKit room
   * @param {string} roomName - Name of the room
   * @param {string} participantName - Name of the participant
   * @param {number} agentId - Agent ID (1-10)
   * @param {Function} onTrackSubscribed - Callback when track is subscribed
   * @param {Function} onParticipantConnected - Callback when participant connects
   * @param {Function} onDisconnected - Callback when disconnected
   * @returns {Promise<Room>} Connected room
   */
  async connectToRoom(
    roomName,
    participantName,
    agentId,
    onTrackSubscribed,
    onParticipantConnected,
    onDisconnected
  ) {
    try {
      // Get room token
      const tokenData = await this.createRoomToken(roomName, participantName, agentId);

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event handlers
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (onTrackSubscribed) {
          onTrackSubscribed(track, publication, participant);
        }
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        if (onParticipantConnected) {
          onParticipantConnected(participant);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        if (onDisconnected) {
          onDisconnected();
        }
      });

      // Connect to room
      await room.connect(tokenData.url, tokenData.token);
      
      // Enable microphone by default (like the working implementation)
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (error) {
        console.warn('Failed to enable microphone:', error);
        // Don't fail the connection if microphone fails
      }

      this.currentRoom = room;
      return room;
    } catch (error) {
      console.error('Error connecting to LiveKit room:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the current room
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.currentRoom) {
      await this.currentRoom.disconnect();
      this.currentRoom = null;
    }
  }

  /**
   * Get the current room
   * @returns {Room|null}
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Publish local audio/video tracks
   * @param {MediaStream} stream - Media stream to publish
   * @returns {Promise<void>}
   */
  async publishTracks(stream) {
    if (!this.currentRoom) {
      throw new Error('Not connected to a room');
    }

    // Publish video track if available
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      await this.currentRoom.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.Camera,
      });
    }

    // Publish audio track if available
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      await this.currentRoom.localParticipant.publishTrack(audioTrack, {
        source: Track.Source.Microphone,
      });
    }
  }

}

// Export singleton instance
export const livekitService = new LiveKitService();

