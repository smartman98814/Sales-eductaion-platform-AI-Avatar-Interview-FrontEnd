/**
 * Backend Status Component
 * Shows backend connection status (for LiveKit token generation)
 * Note: LiveKit agents run separately, so we only check backend connectivity
 */
import { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../services/AgentService';
import '../../styles/backendStatus.css';

export function BackendStatus({ onStatusChange, isAuthenticated }) {
  const [status, setStatus] = useState('idle'); // 'idle', 'checking', 'connected', 'error'
  const [error, setError] = useState(null);

  const checkBackendStatus = useCallback(async () => {
    try {
      setStatus('checking');
      setError(null);

      // Just check if backend is reachable (for LiveKit token generation)
      await agentService.checkHealth();
      
      setStatus('connected');
      // LiveKit agents run separately, so we always mark as ready if backend is connected
      onStatusChange?.({ connected: true, agentsReady: true });
    } catch (err) {
      setError(err.message);
      setStatus('error');
      onStatusChange?.({ connected: false, agentsReady: false });
    }
  }, [onStatusChange]);

  useEffect(() => {
    // Only check backend status when user is authenticated
    if (isAuthenticated) {
      checkBackendStatus();
    } else {
      // Reset status when not authenticated
      setStatus('idle');
      setError(null);
      onStatusChange?.({ connected: false, agentsReady: false });
    }
  }, [isAuthenticated, checkBackendStatus, onStatusChange]);

  if (!isAuthenticated) {
    return null;
  }

  if (status === 'connected') {
    return null; // Hide when backend is connected
  }

  return (
    <div className="backend-status-overlay">
      <div className="backend-status-modal">
        <h2>Backend Connection</h2>
        
        {status === 'checking' && (
          <div className="status-content">
            <div className="spinner-large"></div>
            <p>Checking backend connection...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="status-content status-error">
            <div className="error-icon">⚠️</div>
            <p className="error-message">Cannot connect to backend</p>
            <p className="error-detail">{error}</p>
            <div className="error-actions">
              <button className="btn-retry" onClick={checkBackendStatus}>
                Retry Connection
              </button>
            </div>
            <div className="error-help">
              <strong>Troubleshooting:</strong>
              <ul>
                <li>Ensure backend is running: <code>python run.py</code></li>
                <li>Check backend URL in config: <code>{agentService.baseUrl}</code></li>
                <li>Verify LiveKit credentials are configured in backend .env</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

