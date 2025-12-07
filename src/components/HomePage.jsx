/**
 * Home Page Component
 * Shows login/signup forms on the home page
 */
import { useState, useEffect } from 'react';
import { Login } from './Login';
import { Signup } from './Signup';
import { authService } from '../services/AuthService';

export function HomePage({ onAuthenticated }) {
  const [showSignup, setShowSignup] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        const isValid = await authService.verifyToken();
        if (isValid) {
          onAuthenticated();
          return;
        }
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, [onAuthenticated]);

  const handleAuthSuccess = () => {
    onAuthenticated();
  };

  if (checkingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {showSignup ? (
        <Signup
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={() => setShowSignup(false)}
        />
      ) : (
        <Login
          onSuccess={handleAuthSuccess}
          onSwitchToSignup={() => setShowSignup(true)}
        />
      )}
    </>
  );
}

