
export class WebRTCManager {
  constructor(iceServers, options = {}) {
    this.iceServers = this._enhanceIceServers(iceServers);
    this.options = {
      iceCandidatePoolSize: 10,
      ...options,
    };
    this.peerConnection = null;
    this.iceGatheringTimeout = null;
  }

  /**
   * Create a new RTCPeerConnection
   * @returns {RTCPeerConnection} New peer connection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: this.options.iceCandidatePoolSize,
    });
    return this.peerConnection;
  }

  /**
   * Set remote description
   * @param {RTCSessionDescription} sdp - Remote SDP description
   */
  async setRemoteDescription(sdp) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    const remoteDescription = new RTCSessionDescription(sdp);
    await this.peerConnection.setRemoteDescription(remoteDescription);
  }

  /**
   * Create and set local answer
   * @returns {Promise<RTCSessionDescription>} Local SDP description
   */
  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    const localDescription = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(localDescription);
    return localDescription;
  }

  /**
   * Set up ICE candidate handler
   * @param {Function} onCandidate - Callback for ICE candidates
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   */
  setupIceCandidateHandler(onCandidate) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        onCandidate(candidate);
      }
    };
  }


  /**
   * Configure jitter buffer for receivers
   * @param {number} target - Target jitter buffer in milliseconds (default: 500)
   */
  configureJitterBuffer(target = 500) {
    if (!this.peerConnection) {
      return;
    }
    const receivers = this.peerConnection.getReceivers();
    receivers.forEach((receiver) => {
      if (receiver.jitterBufferTarget !== undefined) {
        receiver.jitterBufferTarget = target;
      }
    });
  }


  /**
   * Close the peer connection
   */
  close() {
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout);
      this.iceGatheringTimeout = null;
    }
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  /**
   * Get the peer connection instance
   * @returns {RTCPeerConnection|null} The peer connection
   */
  getPeerConnection() {
    return this.peerConnection;
  }

  // Private methods

  _enhanceIceServers(iceServers) {
    return [
      ...iceServers,
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
}

