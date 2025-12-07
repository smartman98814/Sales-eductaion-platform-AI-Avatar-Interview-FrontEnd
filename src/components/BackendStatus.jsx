/**
 * Backend Status Component
 * Shows backend connection status and allows initialization
 */
import { useState, useEffect } from 'react';
import { agentService } from '../services/AgentService';
import '../styles/backendStatus.css';

export function BackendStatus({ onStatusChange, isAuthenticated }) {
  const [status, setStatus] = useState('idle'); // 'idle', 'checking', 'connected', 'error', 'initializing'
  const [agentsReady, setAgentsReady] = useState(false);
  const [error, setError] = useState(null);

  const checkBackendStatus = async () => {
    try {
      setStatus('checking');
      setError(null);

      // Check if backend is running
      const agents = await agentService.getAllAgents();
      
      // Check if agents are initialized (have assistant_id)
      const allReady = agents.length === 10 && agents.every(a => a.assistant_id);
      
      setAgentsReady(allReady);
      setStatus('connected');
      onStatusChange?.({ connected: true, agentsReady: allReady });

      if (!allReady) {
        // Try to auto-initialize
        await handleInitialize();
      }
    } catch (err) {
      console.error('Backend check failed:', err);
      setError(err.message);
      setStatus('error');
      onStatusChange?.({ connected: false, agentsReady: false });
    }
  };

  const handleInitialize = async () => {
    try {
      setStatus('initializing');
      await agentService.initializeAgents();
      setAgentsReady(true);
      setStatus('connected');
      onStatusChange?.({ connected: true, agentsReady: true });
    } catch (err) {
      console.error('Initialization failed:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    // Only check backend status when user is authenticated
    if (isAuthenticated) {
      checkBackendStatus();
    } else {
      // Reset status when not authenticated
      setStatus('idle');
      setAgentsReady(false);
      setError(null);
      onStatusChange?.({ connected: false, agentsReady: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Don't show anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (status === 'connected' && agentsReady) {
    return null; // Hide when everything is working
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

        {status === 'initializing' && (
          <div className="status-content">
            <div className="spinner-large"></div>
            <p>Initializing AI agents...</p>
            <p className="status-hint">This may take 10-15 seconds</p>
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
                <li>Check backend URL in .env: <code>{agentService.baseUrl}</code></li>
                <li>Verify OpenAI API key is configured in backend</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

