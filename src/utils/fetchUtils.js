/**
 * Shared fetch utility with retry logic and timeout
 * Used by both HeyGen and OpenAI API services
 */
export async function fetchWithRetry(url, options = {}, retries = 3, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Provide more descriptive error messages
    let errorMessage = error.message;
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // CORS or network error
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = `Network error: Unable to reach ${url}. This may be due to CORS configuration, network issues, or the server being unavailable. Please check your backend URL and CORS settings.`;
      } else {
        errorMessage = `Request failed: ${error.message}`;
      }
    } else if (error.name === 'AbortError') {
      errorMessage = `Request timeout: The request to ${url} took longer than ${timeout}ms`;
    }
    
    if (retries > 0 && (error.name === 'AbortError' || error.name === 'TypeError' || error.message.includes('network'))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
    
    // Create a new error with the improved message
    const enhancedError = new Error(errorMessage);
    enhancedError.name = error.name;
    enhancedError.stack = error.stack;
    throw enhancedError;
  }
}

