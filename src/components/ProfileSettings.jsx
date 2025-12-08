import { useState } from 'react';
import { authService } from '../services/AuthService';
import '../styles/profileSettings.css';

export function ProfileSettings({ onLogout }) {
  const user = authService.getUser();
  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);
    if (newPassword && newPassword.length < 6) {
      setError('Password length must be at least 6 letters.');
      setLoading(false);
      return;
    }
    try {
      await authService.updateProfile({
        username: username.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setStatus('Profile updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setDeleteLoading(true);
    try {
      await authService.deleteAccount(deletePassword);
      setStatus('Account deleted. You will be signed out.');
      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete account.');
    } finally {
      setDeletePassword('');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="profile-settings">
      <div className="profile-card">
        <h1>Account Settings</h1>
        <p className="profile-subtitle">Update your name or password, or delete your account.</p>

        <form className="profile-form" onSubmit={handleUpdate}>
          <div className="form-group">
            <label htmlFor="username">Name</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your display name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="currentPassword">Current Password (required to change password)</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password (optional)</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div className="danger-zone">
          <h2>Danger Zone</h2>
          <p>Delete your account permanently. This cannot be undone.</p>
          <form className="profile-form" onSubmit={handleDelete}>
            <div className="form-group">
              <label htmlFor="deletePassword">Confirm with current password</label>
              <input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            <button type="submit" className="btn-danger" disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </form>
        </div>

        {status && <div className="status success">{status}</div>}
        {error && <div className="status error">{error}</div>}
      </div>
    </div>
  );
}

