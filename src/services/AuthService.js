/**
 * Authentication Service
 * Handles sign up, sign in, and token management
 */
import { config } from '../config';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

class AuthService {
  async parseError(response) {
    try {
      const data = await response.json();
      
      // Handle FastAPI validation errors (detail is an array)
      if (data?.detail) {
        if (Array.isArray(data.detail)) {
          // Format validation errors with user-friendly messages
          return data.detail
            .map(err => {
              const field = err.loc ? err.loc.slice(1).join('.') : 'unknown';
              let message = err.msg || err.message || 'validation error';
              
              // Make error messages more user-friendly
              if (message.includes('pattern') || message.includes('match pattern')) {
                if (field === 'username') {
                  message = 'Username can only contain letters, numbers, spaces, hyphens, and underscores';
                } else if (field === 'email') {
                  message = 'Please enter a valid email address';
                } else {
                  message = `Invalid ${field} format`;
                }
              } else if (message.includes('String should have at least')) {
                const match = message.match(/at least (\d+)/);
                const minLength = match ? match[1] : 'minimum';
                if (field === 'username') {
                  message = `Username must be at least ${minLength} characters long`;
                } else if (field === 'password') {
                  message = `Password must be at least ${minLength} characters long`;
                }
              } else if (message.includes('String should have at most')) {
                const match = message.match(/at most (\d+)/);
                const maxLength = match ? match[1] : 'maximum';
                if (field === 'username') {
                  message = `Username must be at most ${maxLength} characters long`;
                }
              }
              
              return `${field === 'body' ? '' : field.charAt(0).toUpperCase() + field.slice(1) + ': '}${message}`;
            })
            .join('; ');
        } else if (typeof data.detail === 'string') {
          return data.detail;
        } else {
          return JSON.stringify(data.detail);
        }
      }
      
      // Handle other error formats
      if (data?.message) {
        return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      }
      
      return `HTTP ${response.status}: ${response.statusText || 'Error'}`;
    } catch (e) {
      return `HTTP ${response.status}: ${response.statusText || 'Error'}`;
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(email, username, password) {
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      if (!response.ok) {
        const message = await this.parseError(response);
        throw new Error(message || 'Sign up failed');
      }

      const data = await response.json();
      this.setToken(data.access_token);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  /**
   * Sign in an existing user
   */
  async signIn(email, password) {
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const message = await this.parseError(response);
        // Friendly message for unregistered/invalid users
        const friendly =
          response.status === 401
            ? 'Incorrect email or password (or account not found).'
            : message || 'Sign in failed';
        throw new Error(friendly);
      }

      const data = await response.json();
      this.setToken(data.access_token);
      this.setUser(data.user);
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  signOut() {
    this.removeToken();
    this.removeUser();
  }

  /**
   * Get current user from storage
   */
  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Get current token
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Set user data
   */
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * Remove authentication token
   */
  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Remove user data
   */
  removeUser() {
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Update profile (username and/or password)
   */
  async updateProfile({ username, currentPassword, newPassword }) {
    const body = {
      username: username || undefined,
      current_password: currentPassword || undefined,
      new_password: newPassword || undefined,
    };

    const response = await fetch(`${config.backend.baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.detail || (await this.parseError(response));
      throw new Error(message || 'Failed to update profile');
    }

    // Refresh stored token and user
    if (data?.access_token) {
      this.setToken(data.access_token);
    }
    if (data?.user) {
      this.setUser(data.user);
    }
    return data;
  }

  /**
   * Delete account (requires current password)
   */
  async deleteAccount(currentPassword) {
    const response = await fetch(`${config.backend.baseUrl}/api/auth/profile`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ current_password: currentPassword }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.detail || (await this.parseError(response));
      throw new Error(message || 'Failed to delete account');
    }

    this.signOut();
    return data;
  }

  /**
   * Verify current token with backend
   */
  async verifyToken() {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${config.backend.baseUrl}/api/auth/me`, {
        headers: {
          ...this.getAuthHeader(),
        },
      });

      if (response.ok) {
        const user = await response.json();
        this.setUser(user);
        return true;
      } else {
        this.signOut();
        return false;
      }
    } catch (error) {
      this.signOut();
      return false;
    }
  }
}

export const authService = new AuthService();

