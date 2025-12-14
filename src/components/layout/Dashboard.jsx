/**
 * Dashboard Component
 * Main dashboard view for authenticated users
 */
import { AvatarGrid } from './AvatarGrid';
import '../../styles/dashboard.css';

export function Dashboard({ onAvatarSelect, backendReady }) {
  return (
    <div className="dashboard">
      <div className="dashboard-container">      
        <div className="dashboard-content">
          <AvatarGrid 
            onAvatarSelect={onAvatarSelect}
            backendReady={backendReady}
          />
        </div>
      </div>
    </div>
  );
}

