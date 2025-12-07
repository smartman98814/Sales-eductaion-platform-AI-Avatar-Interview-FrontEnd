/**
 * Agent API Service
 * Handles communication with the backend agents API
 */
import { config } from '../config';
import { authService } from './AuthService';

export class AgentService {
  constructor() {
    this.baseUrl = config.backend.baseUrl;
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
   * Check backend health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking backend health:', error);
      throw new Error(`Cannot connect to backend at ${this.baseUrl}`);
    }
  }

  /**
   * Get all available agents
   * @returns {Promise<Array>} List of agents
   */
  async getAllAgents() {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Backend agents endpoint not found');
        }
        throw new Error(`Failed to fetch agents: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  /**
   * Initialize all agents
   * @returns {Promise<Object>} Initialization response
   */
  async initializeAgents() {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/initialize`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || errorData.message || `HTTP ${response.status}`;
        throw new Error(`Failed to initialize agents: ${errorMsg}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error initializing agents:', error);
      throw error;
    }
  }

  /**
   * Chat with an agent using streaming
   * @param {number} agentId - Agent ID (1-10)
   * @param {string} message - Message to send
   * @param {string|null} threadId - Optional thread ID
   * @returns {Promise<ReadableStream>} Streaming response
   */
  async chatWithAgentStream(agentId, message, threadId = null) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/agents/${agentId}/chat/stream`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            message,
            thread_id: threadId,
            buffer_by_sentence: true,
          }),
        }
      );

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch (e) {
          // Response not JSON
        }
        throw new Error(`Failed to chat with agent: ${errorMsg}`);
      }

      return response.body;
    } catch (error) {
      console.error('Error chatting with agent:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentService = new AgentService();

