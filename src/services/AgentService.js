/**
 * Agent API Service
 * Handles communication with the backend agents API
 */
import { config } from '../config';

export class AgentService {
  constructor() {
    this.baseUrl = config.backend.baseUrl;
  }

  /**
   * Get all available agents
   * @returns {Promise<Array>} List of agents
   */
  async getAllAgents() {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents`);
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
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
      });
      if (!response.ok) {
        throw new Error('Failed to initialize agents');
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            thread_id: threadId,
            buffer_by_sentence: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to chat with agent');
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

