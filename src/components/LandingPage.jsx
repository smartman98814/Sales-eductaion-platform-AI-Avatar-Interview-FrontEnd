/**
 * Landing Page Component
 * Marketing/company brand page with sign in and sign up buttons
 */
import { useNavigate } from 'react-router-dom';
import './landing.css';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="landing-container">
          <div className="landing-content">
            <h1 className="landing-title">AI Avatar</h1>
            <h2 className="landing-subtitle">Experience the Future of Interactive Conversations</h2>
            <p className="landing-description">
              Engage with AI-powered avatars in real-time interviews. Our cutting-edge technology 
              brings artificial intelligence to life through natural conversations and lifelike interactions.
            </p>
            
            <div className="landing-features">
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3>AI-Powered</h3>
                <p>Advanced AI technology for natural conversations</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💬</div>
                <h3>Real-Time</h3>
                <p>Interactive sessions with instant responses</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎭</div>
                <h3>Multiple Avatars</h3>
                <p>Choose from various AI personalities</p>
              </div>
            </div>

            <div className="landing-cta">
              <button 
                className="cta-button cta-primary"
                onClick={() => navigate('/signin')}
              >
                Sign In
              </button>
              <button 
                className="cta-button cta-secondary"
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-footer">
        <div className="landing-container">
          <p>&copy; 2024 AI Avatar. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

