import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live connection to one meeting room.
 *
 * Returns { state, status, refused, skew, notice, send }.
 *  - state: the last {t:'state'} frame from the Durable Object (or null)
 *  - status: 'connecting' | 'open' | 'closed'
 *  - refused: true when the server never let us in (not signed in, room closed,
 *    no such room). The browser hides the HTTP status of a failed upgrade, so
 *    we infer it: three attempts in a row that never opened, or a 1008 close.
 *  - skew: server clock minus local clock (ms); add to Date.now() for server time
 */
export function useRoomSocket(code, as = '') {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [refused, setRefused] = useState(false);
  const [skew, setSkew] = useState(0);
  const [notice, setNotice] = useState(null); // { text, id }: why the room refused our last action
  const ws = useRef(null);

  useEffect(() => {
    if (!code) return undefined;
    let stopped = false;
    let timer = 0;
    let retry = 0; // consecutive attempts, for backoff
    let neverOpened = 0; // consecutive attempts that failed before opening

    setState(null);
    setRefused(false);
    setStatus('connecting');

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      // as='screen': the projector, which the room treats as read-only and shows no officer detail.
      const sock = new WebSocket(`${proto}://${location.host}/api/rooms/${encodeURIComponent(code)}/ws${as ? `?as=${as}` : ''}`);
      ws.current = sock;
      let opened = false;

      sock.onopen = () => {
        opened = true;
        retry = 0;
        neverOpened = 0;
        setStatus('open');
      };
      sock.onmessage = (e) => {
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m?.t === 'notice') {
          setNotice({ text: String(m.text ?? ''), id: Date.now() });
          return;
        }
        if (m?.t !== 'state') return;
        setSkew(m.now - Date.now());
        setState(m);
      };
      sock.onclose = (e) => {
        if (stopped || ws.current !== sock) return;
        setStatus('closed');
        if (!opened) neverOpened += 1;
        if (e.code === 1008 || neverOpened >= 3) {
          setRefused(true);
          return;
        }
        const delay = Math.min(1000 * 2 ** retry, 8000);
        retry += 1;
        timer = setTimeout(() => {
          setStatus('connecting');
          connect();
        }, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      const s = ws.current;
      ws.current = null;
      s?.close();
    };
  }, [code, as]);

  const send = useCallback((obj) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(obj));
  }, []);

  return { state, status, refused, skew, notice, send };
}
