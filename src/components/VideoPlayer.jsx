/**
 * Video Player Component
 * Displays streaming video from HeyGen with original background
 */
import { useEffect, useRef, useState } from 'react';
import '../styles/components.css';

export function VideoPlayer({ peerConnection }) {
  const videoRef = useRef(null);
  const [mediaCanPlay, setMediaCanPlay] = useState(false);

  // Handle peer connection tracks
  useEffect(() => {
    if (!peerConnection) return;

    const video = videoRef.current;
    if (!video) return;

    const handleTrack = (event) => {
      if (event.track && (event.track.kind === 'audio' || event.track.kind === 'video')) {
        let streamToUse = null;
        
        if (event.streams && event.streams.length > 0) {
          streamToUse = event.streams[0];
        } else if (event.track) {
          streamToUse = new MediaStream([event.track]);
        }
        
        if (streamToUse && video) {
          video.srcObject = streamToUse;
          setTimeout(() => {
            video.play().catch(err => {
              console.error('Error playing video:', err);
            });
          }, 100);
        }
      }
    };

    peerConnection.ontrack = handleTrack;

    // Check for existing receivers
    setTimeout(() => {
      const receivers = peerConnection.getReceivers();
      if (receivers.length > 0) {
        const tracks = receivers.map(r => r.track).filter(t => t && t.readyState !== 'ended');
        if (tracks.length > 0) {
          const stream = new MediaStream(tracks);
          if (video) {
            video.srcObject = stream;
            video.play().catch(err => {
              console.error('Error playing video from existing tracks:', err);
            });
          }
        }
      }
    }, 500);

    return () => {
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => {
          track.stop();
        });
        video.srcObject = null;
      }
    };
  }, [peerConnection]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setMediaCanPlay(true);
      video.play().catch(err => {
        console.error('Error auto-playing video:', err);
      });
    };

    const handleCanPlay = () => {
      setMediaCanPlay(true);
      video.play().catch(err => {
        console.error('Error playing video:', err);
      });
    };

    const handlePlay = () => {
      setMediaCanPlay(true);
    };

    const handleError = (e) => {
      console.error('Video error:', e, video.error);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className="videoSectionWrap">
      <div className="videoWrap">
        <video
          ref={videoRef}
          id="mediaElement"
          className="videoElement"
          autoPlay
          playsInline
          muted={false}
        />
        {!mediaCanPlay && peerConnection && (
          <div className="videoLoadingOverlay">
            <div>Waiting for video stream...</div>
            <small>Connection: {peerConnection.connectionState || 'establishing'}</small><br />
            <small>Check browser console (F12) for details</small>
          </div>
        )}
        {!peerConnection && (
          <div className="videoNoSession">
            <div>No active session</div>
            <small>Create a session to see the video</small>
          </div>
        )}
      </div>
    </div>
  );
}
