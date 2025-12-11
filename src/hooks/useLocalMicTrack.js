/**
 * Hook to get local microphone track reference for transcription
 * Similar to the "new" project implementation
 */
import { useMemo } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function useLocalMicTrack() {
  const { microphoneTrack, localParticipant } = useLocalParticipant();

  const micTrackRef = useMemo(() => {
    if (!localParticipant || !microphoneTrack) {
      return null;
    }
    
    return {
      participant: localParticipant,
      source: Track.Source.Microphone,
      publication: microphoneTrack,
    };
  }, [localParticipant, microphoneTrack]);

  return micTrackRef;
}

