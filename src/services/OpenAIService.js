/**
 * OpenAI API Service Class
 * Handles communication with OpenAI via backend
 */
import { config } from '../config';
import { fetchWithRetry } from '../utils/fetchUtils';

export class OpenAIService {
  constructor() {
    this.baseUrl = config.backend.baseUrl;
  }

  /**
   * Send a prompt to OpenAI and get a text response
   * @param {string} prompt - The prompt to send to OpenAI
   * @returns {Promise<string>} The AI-generated text response
   */
  async complete(prompt) {
    const response = await fetchWithRetry(`${this.baseUrl}/api/openai/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    }, 3, 60000);
    
    if (response.status === 500) {
      throw new Error('Server error');
    }
    
    const data = await response.json();
    return data.text;
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();

