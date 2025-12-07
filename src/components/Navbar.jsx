/**
 * Navbar Component
 * Navigation bar with authentication buttons
 */
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/AuthService';
import './navbar.css';

export function Navbar({ isAuthenticated, onAuthenticated, onLogout }) {
  const navigate = useNavigate();
  const user = isAuthenticated ? authService.getUser() : null;

  const handleLogout = () => {
    onLogout();
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <h1>AI Avatar</h1>
          </div>

          <div className="navbar-menu">
            {isAuthenticated ? (
              <div className="navbar-user">
                <span className="navbar-username">
                  {user?.username || user?.email || 'User'}
                </span>
                <button className="navbar-button navbar-button-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className="navbar-auth">
                <button 
                  className="navbar-button navbar-button-signin"
                  onClick={() => navigate('/signin')}
                >
                  Sign In
                </button>
                <button 
                  className="navbar-button navbar-button-signup"
                  onClick={() => navigate('/signup')}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

