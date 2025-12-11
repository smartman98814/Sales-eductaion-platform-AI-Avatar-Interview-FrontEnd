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

}

// Export singleton instance
export const agentService = new AgentService();

