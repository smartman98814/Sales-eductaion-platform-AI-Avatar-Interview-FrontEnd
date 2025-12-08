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
      return data?.detail || data?.message || `HTTP ${response.status}`;
    } catch (e) {
      return `HTTP ${response.status}`;
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
      console.error('Token verification error:', error);
      this.signOut();
      return false;
    }
  }
}

export const authService = new AuthService();

