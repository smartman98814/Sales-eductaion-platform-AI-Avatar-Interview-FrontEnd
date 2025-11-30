import { useEffect, useRef } from 'react';

export function StatusDisplay({ messages }) {
  const statusRef = useRef(null);

  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.scrollTop = statusRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={statusRef}
      id="status"
      className="status"
      dangerouslySetInnerHTML={{ __html: messages.join('<br>') }}
    />
  );
}

