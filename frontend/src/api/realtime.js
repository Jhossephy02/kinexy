const API_EVENTS = '/api/events';

function emit(detail) {
  window.dispatchEvent(new CustomEvent('kinexy-realtime', { detail }));
  const path = detail?.data?.path || '';
  if (/wallet|tips|unlock|payments|messages|membership|publication-plan/.test(path)) window.dispatchEvent(new Event('kinexy-wallet-updated'));
}

export function connectRealtime(token) {
  let stopped = false;
  let controller;
  let retryTimer;
  let attempts = 0;
  const connect = async () => {
    if (stopped || !token) return;
    controller = new AbortController();
    try {
      const response = await fetch(API_EVENTS, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (response.status === 401) return;
      if (!response.ok || !response.body) throw new Error(`Realtime ${response.status}`);
      attempts = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          if (!frame || frame.startsWith(':')) continue;
          let event = 'message'; let data = {};
          for (const line of frame.split(/\r?\n/)) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) { try { data = JSON.parse(line.slice(5).trim()); } catch { data = {}; } }
          }
          emit({ event, data });
        }
      }
      if (!stopped) throw new Error('Realtime disconnected');
    } catch (error) {
      if (stopped || error?.name === 'AbortError') return;
      attempts += 1;
      retryTimer = window.setTimeout(connect, Math.min(15000, 1000 * (2 ** Math.min(attempts, 4))));
    }
  };
  connect();
  return () => { stopped = true; window.clearTimeout(retryTimer); controller?.abort(); };
}
