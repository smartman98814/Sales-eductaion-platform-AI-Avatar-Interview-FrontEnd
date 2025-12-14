/**
 * Avatar Grid Component
 * Displays 10 avatars in a 2x5 grid with hover details
 */
import { useState } from 'react';
import { AVATARS } from '../../data/avatarData';
import '../../styles/avatarGrid.css';

export function AvatarGrid({ onAvatarSelect, backendReady }) {
  const [hoveredAvatar, setHoveredAvatar] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0, showBelow: false });

  const handleAvatarHover = (avatar, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // const viewportHeight = window.innerHeight;
    
    // Check if avatar is in first row (IDs 1-5) or if there's not enough space above
    const isFirstRow = avatar.id <= 5;
    const spaceAbove = rect.top;
    const modalHeight = 350; // Approximate modal height
    const needsSpaceBelow = isFirstRow || spaceAbove < modalHeight;
    
    setModalPosition({
      x: rect.left + rect.width / 2,
      y: needsSpaceBelow ? rect.bottom : rect.top,
      showBelow: needsSpaceBelow,
    });
    setHoveredAvatar(avatar);
  };

  const handleAvatarLeave = () => {
    setHoveredAvatar(null);
  };

  return (
    <div className="avatar-grid-container">
      <h1 className="grid-title">Select Your Interview Customer</h1>
      <p className="grid-subtitle">Choose one of 10 AI customer personas to practice your sales pitch</p>
      
      {!backendReady && (
        <div className="backend-notice">
          <div className="notice-icon">⏳</div>
          <p>Initializing backend AI agents... Please wait</p>
        </div>
      )}
      
      <div className="avatar-grid">
        {AVATARS.map((avatar) => (
          <div
            key={avatar.id}
            className="avatar-card"
            onMouseEnter={(e) => handleAvatarHover(avatar, e)}
            onMouseLeave={handleAvatarLeave}
            onClick={() => onAvatarSelect(avatar)}
          >
            <div className="avatar-image-container">
              <img 
                src={avatar.imageUrl} 
                alt={avatar.name}
                className="avatar-image"
                loading="lazy"
              />
            </div>
            <div className="avatar-name">{avatar.name}</div>
            <div className="avatar-role-short">{avatar.role.split(' ').slice(0, 3).join(' ')}</div>
          </div>
        ))}
      </div>

      {/* Hover Modal */}
      {hoveredAvatar && (
        <div 
          className={`avatar-modal ${modalPosition.showBelow ? 'modal-below' : 'modal-above'}`}
          style={{
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
          }}
        >
          <div className="modal-header">
            <div className="modal-avatar-image-container">
              <img 
                src={hoveredAvatar.imageUrl} 
                alt={hoveredAvatar.name}
                className="modal-avatar-image"
              />
            </div>
            <div>
              <h3 className="modal-name">{hoveredAvatar.fullName}</h3>
              <p className="modal-role">{hoveredAvatar.role}</p>
            </div>
          </div>
          <div className="modal-content">
            <div className="modal-section">
              <strong>Description:</strong>
              <p>{hoveredAvatar.description}</p>
            </div>
            <div className="modal-section">
              <strong>Personality:</strong>
              <p>{hoveredAvatar.personality}</p>
            </div>
          </div>
          <div className="modal-footer">
            <p>Click to start interview</p>
          </div>
        </div>
      )}
    </div>
  );
}

