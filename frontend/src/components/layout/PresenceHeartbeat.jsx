import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

export default function PresenceHeartbeat() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const ping = () => { if (document.visibilityState === 'visible') api.post('/presence/heartbeat', {}).catch(() => {}); };
    ping();
    const timer = window.setInterval(ping, 30000);
    document.addEventListener('visibilitychange', ping);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', ping); };
  }, [isAuthenticated]);

  return null;
}
