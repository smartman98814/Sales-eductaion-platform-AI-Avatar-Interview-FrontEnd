/**
 * Loading Screen Component
 * Displays while HeyGen session is being created
 */
import '../../styles/loadingScreen.css';

export function LoadingScreen({ avatar, status, onCancel }) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div 
          className="loading-avatar-circle"
          style={{ backgroundColor: avatar.backgroundColor }}
        >
          <span className="loading-avatar-initials">{avatar.initials}</span>
        </div>
        
        <h2 className="loading-title">Preparing Interview with {avatar.name}</h2>
        
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
        </div>
        
        <p className="loading-status">{status}</p>
        
        <button className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

