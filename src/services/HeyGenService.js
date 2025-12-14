/**
 * HeyGen API Service Class
 * Encapsulates all HeyGen API interactions
 */
import { config } from '../config';
import { fetchWithRetry } from '../utils/fetchUtils';

export class HeyGenService {
  constructor() {
    this.apiKey = config.heygen.apiKey;
    this.serverUrl = config.heygen.serverUrl;
  }

  /**
   * Fetch available voices from HeyGen API
   * @returns {Promise<Array>} Array of voice objects with id and name
   */
  async fetchVoices() {
    // Try v2 endpoint first (recommended)
    let response = await fetchWithRetry(`${this.serverUrl}/v2/voices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    }, 3, 30000);

    // If v2 fails, try v1
    if (!response.ok) {
      response = await fetchWithRetry(`${this.serverUrl}/v1/voices.list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
      }, 3, 30000);
    }

    if (response.ok) {
      const data = await response.json();
      return this._parseVoicesResponse(data);
    }
    
    return [];
  }

  /**
   * Fetch available avatars from HeyGen API (Streaming/Interactive only)
   * @returns {Promise<Array>} Array of avatar objects with id and name
   */
  async fetchAvatars() {
    const endpoint = `${this.serverUrl}/v1/streaming/avatar.list`;
    const response = await fetchWithRetry(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    }, 3, 30000);

    if (response.ok) {
      const data = await response.json();
      return this._parseAvatarsResponse(data);
    }
    
    return [];
  }

  /**
   * Create a new WebRTC streaming session
   * @param {string} quality - Video quality ('low', 'medium', 'high')
   * @param {string} avatarName - Avatar ID or name
   * @param {string} voiceId - Voice ID
   * @returns {Promise<Object>} Session data with SDP and ICE servers
   */
  async createSession(quality, avatarName, voiceId) {
    const requestBody = {
      quality,
      avatar_name: avatarName,
      voice: {
        voice_id: voiceId,
      },
    };

    const response = await fetchWithRetry(`${this.serverUrl}/v1/streaming.new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    }, 3, 60000);

    const responseData = await response.json();
    
    if (!response.ok) {
      const errorMessage = responseData.message || responseData.error || `Server error (${response.status})`;
      throw new Error(errorMessage);
    }

    if (response.status === 500) {
      throw new Error('Server error');
    }

    return responseData.data;
  }

  /**
   * Start the streaming session
   * @param {string} sessionId - Session ID
   * @param {RTCSessionDescription} sdp - Local SDP description
   * @returns {Promise<Object>} Session start response
   */
  async startSession(sessionId, sdp) {
    const response = await fetchWithRetry(`${this.serverUrl}/v1/streaming.start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({ session_id: sessionId, sdp }),
    }, 3, 60000);
    
    if (response.status === 500) {
      throw new Error('Server error');
    }
    
    const data = await response.json();
    return data.data;
  }

  /**
   * Submit ICE candidate (fire and forget for performance)
   * @param {string} sessionId - Session ID
   * @param {RTCIceCandidate} candidate - ICE candidate
   */
  async submitIceCandidate(sessionId, candidate) {
    fetch(`${this.serverUrl}/v1/streaming.ice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({ session_id: sessionId, candidate }),
    }).catch(() => {});
  }

  /**
   * Send task (repeat text) to avatar
   * @param {string} sessionId - Session ID
   * @param {string} text - Text to speak
   * @returns {Promise<Object>} Task response
   */
  async sendTask(sessionId, text) {
    const response = await fetchWithRetry(`${this.serverUrl}/v1/streaming.task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({ session_id: sessionId, text }),
    }, 3, 30000);
    
    if (response.status === 500) {
      throw new Error('Server error');
    }
    
    const data = await response.json();
    return data.data;
  }

  /**
   * Stop/close a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Stop response
   */
  async stopSession(sessionId) {
    const response = await fetchWithRetry(`${this.serverUrl}/v1/streaming.stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({ session_id: sessionId }),
    }, 2, 20000);
    
    if (response.status === 500) {
      throw new Error('Server error');
    }
    
    const data = await response.json();
    return data.data;
  }

  /**
   * Stop session synchronously (for cleanup during page unload)
   * Uses sendBeacon for reliability when browser is closing
   * @param {string} sessionId - Session ID to stop
   */
  stopSessionSync(sessionId) {
    if (!sessionId) return;
    
    try {
      const url = `${this.serverUrl}/v1/streaming.stop`;
      const payload = JSON.stringify({ 
        session_id: sessionId 
      });
      
      // Method 1: sendBeacon (most reliable for page unload)
      // Note: sendBeacon has limitations with custom headers
      const blob = new Blob([payload], { type: 'application/json' });
      const beaconUrl = `${url}?x-api-key=${encodeURIComponent(this.apiKey)}`;
      const sent = navigator.sendBeacon(beaconUrl, blob);
      
      if (!sent) {
        // Method 2: Fallback with keepalive fetch
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
          body: payload,
          keepalive: true, // Request continues even if page closes
        }).catch(() => {
          // Silently fail on cleanup
        });
      }
    } catch (error) {
      // Silently fail on cleanup
    }
  }

  /**
   * List all active sessions
   * @returns {Promise<Array>} Array of active sessions
   */
  async listSessions() {
    const endpoints = [
      `${this.serverUrl}/v1/sessions.list`,
      `${this.serverUrl}/v1/streaming.list`,
      `${this.serverUrl}/v1/sessions`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetchWithRetry(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
        }, 2, 20000);

        if (response.ok) {
          const data = await response.json();
          return this._parseSessionsResponse(data);
        }
      } catch (error) {
        // Try next endpoint
      }
    }
    
    return [];
  }

  /**
   * Close a specific session by ID
   * @param {string} sessionId - Session ID to close
   * @returns {Promise<Object>} Result object with success status
   */
  async closeSessionById(sessionId) {
    try {
      const response = await fetchWithRetry(`${this.serverUrl}/v1/streaming.stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({ session_id: sessionId }),
      }, 2, 20000);

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Failed to close session' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Private helper methods

  _parseVoicesResponse(data) {
    let voices = [];
    if (data.data && Array.isArray(data.data)) {
      voices = data.data;
    } else if (data.data && data.data.voices && Array.isArray(data.data.voices)) {
      voices = data.data.voices;
    } else if (data.voices && Array.isArray(data.voices)) {
      voices = data.voices;
    } else if (Array.isArray(data)) {
      voices = data;
    }
    
    if (voices.length > 0) {
      return voices.map(voice => ({
        id: voice.voice_id || voice.id || voice.voiceId,
        name: voice.name || voice.display_name || voice.displayName || `${voice.voice_id || voice.id || voice.voiceId} (${voice.language || voice.lang || 'Unknown'})`,
      }));
    }
    return [];
  }

  _parseAvatarsResponse(data) {
    let avatars = [];
    if (data.data && Array.isArray(data.data)) {
      avatars = data.data;
    } else if (data.data && data.data.avatars && Array.isArray(data.data.avatars)) {
      avatars = data.data.avatars;
    } else if (data.avatars && Array.isArray(data.avatars)) {
      avatars = data.avatars;
    } else if (Array.isArray(data)) {
      avatars = data;
    }
    
    if (avatars.length > 0) {
      const streamingAvatars = avatars.filter(avatar => {
        const isStreaming = 
          avatar.is_streaming === true ||
          avatar.is_streaming_avatar === true ||
          avatar.streaming_enabled === true ||
          avatar.type === 'streaming' ||
          avatar.type === 'interactive' ||
          avatar.avatar_type === 'streaming' ||
          avatar.avatar_type === 'interactive' ||
          avatar.capabilities?.includes('streaming') ||
          avatar.capabilities?.includes('interactive') ||
          (avatar.is_streaming === undefined && 
           avatar.is_streaming_avatar === undefined &&
           avatar.streaming_enabled === undefined &&
           avatar.type === undefined &&
           avatar.avatar_type === undefined);
        
        return isStreaming;
      });
      
      const avatarsToUse = streamingAvatars.length > 0 ? streamingAvatars : avatars;
      
      return avatarsToUse.map(avatar => ({
        id: avatar.avatar_id || avatar.id || avatar.avatarId,
        name: avatar.name || avatar.display_name || avatar.displayName || avatar.avatar_name || `${avatar.avatar_id || avatar.id || avatar.avatarId}`,
        isStreaming: avatar.is_streaming || avatar.is_streaming_avatar || avatar.streaming_enabled || true,
      }));
    }
    return [];
  }

  _parseSessionsResponse(data) {
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    } else if (data.sessions && Array.isArray(data.sessions)) {
      return data.sessions;
    } else if (Array.isArray(data)) {
      return data;
    }
    return [];
  }
}

// Export singleton instance
export const heygenService = new HeyGenService();

