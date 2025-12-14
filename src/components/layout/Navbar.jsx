/**
 * Navbar Component
 * Navigation bar with authentication buttons
 */
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { authService } from '../../services/AuthService';
import '../../styles/navbar.css';

export function Navbar({ isAuthenticated, onLogout }) {
  const navigate = useNavigate();
  const user = isAuthenticated ? authService.getUser() : null;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    onLogout();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const initials =
    user?.username?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-left">
            <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <h1>Home</h1>
            </div>
            {isAuthenticated && (
              <button 
                className="navbar-button navbar-button-dashboard"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </button>
            )}
          </div>

          <div className="navbar-menu">
            {isAuthenticated ? (
              <div className="navbar-user" ref={dropdownRef}>
                <button
                  className="profile-button"
                  onClick={toggleDropdown}
                  aria-haspopup="true"
                  aria-expanded={isDropdownOpen}
                  type="button"
                >
                  <div className="profile-avatar">{initials}</div>
                </button>
                {isDropdownOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-header">
                      <div className="profile-avatar small">{initials}</div>
                      <div className="profile-info">
                        <span className="profile-name">{user?.username || user?.email || 'User'}</span>
                        <span className="profile-email">{user?.email}</span>
                      </div>
                    </div>
                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        navigate('/settings');
                        setIsDropdownOpen(false);
                      }}
                    >
                      Settings
                    </button>
                    <button
                      className="dropdown-item dropdown-logout"
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
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

