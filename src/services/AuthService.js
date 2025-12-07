/**
 * Authentication Service
 * Handles sign up, sign in, and token management
 */
import { config } from '../config';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

class AuthService {
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
        const error = await response.json();
        throw new Error(error.detail || 'Sign up failed');
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
        const error = await response.json();
        throw new Error(error.detail || 'Sign in failed');
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

