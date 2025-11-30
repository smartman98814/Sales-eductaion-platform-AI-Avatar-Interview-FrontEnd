/**
 * Avatar Selector Component
 * Allows selection of avatars from dropdown or manual input
 */
import { useState, useEffect } from 'react';
import { heygenService } from '../services/HeyGenService';

export function AvatarSelector({ value, onChange, onManualChange, manualValue }) {
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAvatars = async () => {
    setLoading(true);
    try {
      const fetchedAvatars = await heygenService.fetchAvatars();
      setAvatars(fetchedAvatars);
    } catch (error) {
      console.error('Error loading avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvatars();
  }, []);

  const handleDropdownChange = (e) => {
    if (e.target.value) {
      onChange(e.target.value);
      onManualChange('');
    }
  };

  const handleManualChange = (e) => {
    const val = e.target.value.trim();
    onManualChange(val);
    if (val) {
      onChange('');
    }
  };

  return (
    <div className="actionRow">
      <label>
        Avatar
        <select 
          id="avatarID" 
          value={value} 
          onChange={handleDropdownChange}
          disabled={loading}
        >
          <option value="">
            {loading ? 'Loading avatars...' : 'Select an avatar...'}
          </option>
          {avatars.map(avatar => (
            <option key={avatar.id} value={avatar.id}>
              {avatar.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Or enter Avatar ID manually:
        <input
          id="avatarIDManual"
          type="text"
          placeholder="Enter avatar ID"
          value={manualValue}
          onChange={handleManualChange}
        />
      </label>
      <button 
        className="refreshBtn" 
        onClick={loadAvatars}
        title="Refresh avatars list"
      >
        🔄
      </button>
    </div>
  );
}
