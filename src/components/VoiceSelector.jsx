/**
 * Voice Selector Component
 * Allows selection of voices from dropdown or manual input
 */
import { useState, useEffect } from 'react';
import { heygenService } from '../services/HeyGenService';

export function VoiceSelector({ value, onChange, onManualChange, manualValue, onVoiceChange }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const fetchedVoices = await heygenService.fetchVoices();
      setVoices(fetchedVoices);
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVoices();
  }, []);

  const handleDropdownChange = (e) => {
    if (e.target.value) {
      onChange(e.target.value);
      onManualChange('');
      if (onVoiceChange) {
        onVoiceChange(e.target.value);
      }
    }
  };

  const handleManualChange = (e) => {
    const val = e.target.value.trim();
    onManualChange(val);
    if (val) {
      onChange('');
      if (onVoiceChange) {
        onVoiceChange(val);
      }
    }
  };

  return (
    <div className="actionRow">
      <label>
        Voice
        <select 
          id="voiceID" 
          value={value} 
          onChange={handleDropdownChange}
          disabled={loading}
        >
          <option value="">
            {loading ? 'Loading voices...' : 'Select a voice...'}
          </option>
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Or enter Voice ID manually:
        <input
          id="voiceIDManual"
          type="text"
          placeholder="Enter voice ID"
          value={manualValue}
          onChange={handleManualChange}
        />
      </label>
      <button 
        className="refreshBtn" 
        onClick={loadVoices}
        title="Refresh voices list"
      >
        🔄
      </button>
    </div>
  );
}
