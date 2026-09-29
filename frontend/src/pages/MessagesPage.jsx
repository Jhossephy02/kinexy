import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import AppIcon from '../components/ui/AppIcon.jsx';

export default function MessagesPage({ embedded = false, onExit }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [access, setAccess] = useState(null);
  const [tipAmount, setTipAmount] = useState(25);
  const [notice, setNotice] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const messagesViewportRef = useRef(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const loadConversations = () => api.get('/messages/conversations').then((res) => {
      if (active) {
        setConversations(res?.conversations || []);
        const requestedPartner = Number(new URLSearchParams(location.search).get('partner_id'));
        if (requestedPartner > 0) {
          const found = (res?.conversations || []).find(item => Number(item.partner_id) === requestedPartner);
          setActivePartner(found || { partner_id: requestedPartner, partner_name: 'Creador' });
        }
        setLoadingConv(false);
      }
    }).catch(() => {
      if (active) setLoadingConv(false);
    });
    loadConversations();
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update' && event.detail?.data?.path?.startsWith('/api/messages')) loadConversations(); };
    window.addEventListener('kinexy-realtime', onRealtime);
    const timer = window.setInterval(loadConversations, 60000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('kinexy-realtime', onRealtime); };
  }, [isAuthenticated, location.search]);

  useEffect(() => {
    if (!activePartner) return;
    stickToBottom.current = true;
    let active = true;
    setLoadingMsg(true);
    const loadMessages = () => api.get(`/messages?partner_id=${activePartner.partner_id}`).then((res) => {
      if (active) {
        setMessages(res?.messages || []);
        const unread = (res?.messages || []).filter(item => Number(item.receiver_id) === Number(user?.id) && !item.read);
        unread.forEach(item => api.patch(`/messages/${item.id}/read`).catch(() => {}));
        setLoadingMsg(false);
      }
    }).catch(() => {
      if (active) setLoadingMsg(false);
    });
    loadMessages();
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update' && event.detail?.data?.path?.startsWith('/api/messages')) loadMessages(); };
    window.addEventListener('kinexy-realtime', onRealtime);
    const timer = window.setInterval(loadMessages, 60000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('kinexy-realtime', onRealtime); };
  }, [activePartner, user?.id]);

  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (viewport && stickToBottom.current) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, partnerTyping, activePartner?.partner_id]);

  useEffect(() => {
    if (!activePartner || !user?.id) return;
    const onRealtime = (event) => {
      const detail = event.detail;
      if (detail?.event === 'typing:update' && Number(detail.data?.sender_id) === Number(activePartner.partner_id) && Number(detail.data?.receiver_id) === Number(user.id)) setPartnerTyping(Boolean(detail.data.typing));
    };
    window.addEventListener('kinexy-realtime', onRealtime);
    return () => { window.removeEventListener('kinexy-realtime', onRealtime); setPartnerTyping(false); };
  }, [activePartner, user?.id]);

  useEffect(() => () => {
    window.clearTimeout(typingTimer.current);
    if (activePartner) api.post('/messages/typing', { receiver_id: activePartner.partner_id, typing: false }).catch(() => {});
  }, [activePartner]);

  useEffect(() => {
    if (!activePartner) { setAccess(null); return; }
    let active = true;
    const loadAccess = () => api.get(`/messages/access?partner_id=${activePartner.partner_id}`).then((data) => active && setAccess(data)).catch(() => active && setAccess(null));
    const onRealtime = (event) => {
      if (event.detail?.event === 'platform:update' && /\/api\/messages\/(unlock|access)/.test(event.detail?.data?.path || '')) loadAccess();
    };
    loadAccess();
    window.addEventListener('kinexy-realtime', onRealtime);
    return () => { active = false; window.removeEventListener('kinexy-realtime', onRealtime); };
  }, [activePartner]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activePartner) return;
    if (access?.requires_contribution && !access?.unlocked) { setNotice(`Aporta ${access.cost} tokens para habilitar este chat.`); return; }
    const currentText = text;
    setText('');
    window.clearTimeout(typingTimer.current);
    api.post('/messages/typing', { receiver_id: activePartner.partner_id, typing: false }).catch(() => {});
    try {
      const res = await api.post('/messages', { receiver_id: activePartner.partner_id, text: currentText });
      const newMsg = res?.message || res;
      if (newMsg && newMsg.id) {
        stickToBottom.current = true;
        setMessages((prev) => [...prev, newMsg]);
      }
    } catch (err) {
      setNotice(err.message);
    }
  };

  const unlockChat = async () => {
    if (!activePartner) return;
    try {
      const result = await api.post('/messages/unlock', { receiver_id: activePartner.partner_id });
      setAccess({ unlocked: true, requires_contribution: true, cost: result.cost });
      setNotice(`Aporte de ${result.cost} tokens realizado. Ya puedes escribir.`);
      window.dispatchEvent(new Event('kinexy-wallet-updated'));
    } catch (err) { setNotice(err.message); }
  };

  const sendTip = async () => {
    if (!activePartner || sendingTip) return;
    setSendingTip(true);
    try {
      const result = await api.post('/tips', { receiver_id: activePartner.partner_id, amount: Number(tipAmount) });
      setNotice(`Enviaste ${result.tip.amount} tokens a ${activePartner.partner_name}.`);
      window.dispatchEvent(new Event('kinexy-wallet-updated'));
    } catch (err) { setNotice(err.message); }
    finally { setSendingTip(false); }
  };

  const Root = embedded ? 'section' : 'main';
  return (
    <Root className={`messages-page ${embedded ? 'messages-embedded' : ''}`} id={embedded ? undefined : 'main-content'} style={{ display: 'flex', height: embedded ? 'min(700px, calc(100dvh - 235px))' : 'calc(100dvh - 94px)', minHeight: embedded ? '520px' : 0, overflow: 'hidden', background: 'var(--black)', borderRadius: embedded ? '16px' : 0, border: embedded ? '1px solid var(--border)' : 0 }}>
      <aside className={`messages-sidebar ${activePartner ? 'mobile-hidden' : ''}`} style={{ width: '300px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div className="messages-title-row"><div><span className="eyebrow"><AppIcon name="message" /> MENSAJES</span><h2 style={{ fontSize: '1.5rem', margin: 0 }}>Tus chats</h2></div>{embedded && <button className="messages-exit" onClick={onExit}><AppIcon name="arrow" style={{ transform: 'rotate(180deg)' }}/>Panel</button>}</div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConv ? <p style={{ padding: '20px', color: 'var(--muted)' }}>Cargando...</p> : conversations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
              <AppIcon name="message" size={32} />
              <p>Inicia una conversación con un creador</p>
            </div>
          ) : conversations.map(c => (
            <button 
              key={c.partner_id} 
              onClick={() => setActivePartner(c)}
              style={{ width: '100%', display: 'flex', padding: '15px', borderBottom: '1px solid var(--border)', background: activePartner?.partner_id === c.partner_id ? 'var(--card)' : 'transparent', textAlign: 'left', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #f2677f, #991b1b)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0, color: 'white', fontWeight: '700', fontSize: '16px' }}>
                {(c.partner_name || '#')?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <strong style={{ display: 'block', fontSize: '1rem' }}>{c.partner_name}</strong>
                <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.last_message}</small>
              </div>
              {c.unread_count > 0 && <span style={{ background: 'var(--red)', color: 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '0.8rem', height: 'fit-content' }}>{c.unread_count}</span>}
            </button>
          ))}
        </div>
      </aside>
      
      <section className={`messages-chat ${!activePartner ? 'mobile-hidden' : ''}`} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--card)' }}>
        {activePartner ? (
          <>
            <header style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
              <button className="mobile-only" onClick={() => setActivePartner(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', marginRight: '10px', fontSize: '1.5rem' }} aria-label="Volver a todos los chats">
                <AppIcon name="arrow" style={{ transform: 'rotate(180deg)' }} />
              </button>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{activePartner.partner_name}</h2>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {embedded && <button className="messages-exit messages-exit-chat" onClick={onExit}><AppIcon name="arrow" style={{ transform: 'rotate(180deg)' }}/>Panel</button>}
                <input aria-label="Tokens para el tip" type="text" inputMode="numeric" pattern="[0-9]*" min="1" max="10000" value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} style={{ width: '62px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--black)', color: 'var(--text)' }} />
                <button onClick={sendTip} disabled={sendingTip} style={{ padding: '8px 11px', border: '1px solid #704053', borderRadius: '9px', background: '#2a1b24', color: '#ffd1df', fontWeight: '700', cursor: 'pointer' }}>{sendingTip ? '...' : 'Enviar tip'}</button>
              </div>
            </header>
            {notice && <div role="status" style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid #6b4153', borderRadius: '10px', color: '#ffd1df', fontSize: '0.85rem' }}>{notice}</div>}
            <div ref={messagesViewportRef} onScroll={event => { const viewport = event.currentTarget; stickToBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100; }} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingMsg ? <p style={{ color: 'var(--muted)' }}>Cargando mensajes...</p> : messages.map(m => (
                <div key={m.id} style={{ maxWidth: '70%', padding: '10px 15px', borderRadius: 'var(--radius)', alignSelf: m.sender_id == user?.id ? 'flex-end' : 'flex-start', background: m.sender_id == user?.id ? 'var(--red)' : 'var(--border)' }}>
                  <p style={{ margin: 0 }}>{m.text}</p>
                  <small style={{ opacity: 0.7, fontSize: '0.75rem', marginTop: '5px', display: 'block' }}>{new Date(m.created_at).toLocaleTimeString()}</small>
                </div>
              ))}
              {partnerTyping && <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '14px', background: 'var(--border)', color: 'var(--muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Está escribiendo…</div>}
            </div>
            {access?.requires_contribution && !access.unlocked ? <div style={{ margin: '0 20px 12px', padding: '13px 14px', borderRadius: '12px', border: '1px solid #674052', background: '#251923', display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ flex: 1 }}><strong style={{ display: 'block', color: '#ffe1ea' }}>Aporte para escribir</strong><small style={{ color: 'var(--muted)' }}>Aporta {access.cost} tokens a {activePartner.partner_name} para abrir este chat.</small></div><button onClick={unlockChat} style={{ whiteSpace: 'nowrap', padding: '9px 12px', border: 0, borderRadius: '9px', background: 'var(--red)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Aportar {access.cost}</button></div> : null}
            <form onSubmit={handleSend} style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
              <input type="text" value={text} onChange={(e) => { const value = e.target.value; setText(value); if (activePartner && user?.id) { const now = Date.now(); if (value && now - lastTypingSent.current > 1000) { lastTypingSent.current = now; api.post('/messages/typing', { receiver_id: activePartner.partner_id, typing: true }).catch(() => {}); } window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(() => api.post('/messages/typing', { receiver_id: activePartner.partner_id, typing: false }).catch(() => {}), 1800); if (!value) api.post('/messages/typing', { receiver_id: activePartner.partner_id, typing: false }).catch(() => {}); } }} placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--black)', color: 'var(--text)' }} />
              <button type="submit" disabled={!text.trim()} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <AppIcon name="arrow" />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            <AppIcon name="message" size={48} />
            <p style={{ marginTop: '20px' }}>Selecciona una conversación para empezar</p>
          </div>
        )}
      </section>
      
      <style>{`
        .messages-title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .messages-exit { display:inline-flex; align-items:center; gap:6px; min-height:34px; padding:7px 9px; border:1px solid #664153; border-radius:9px; background:#271b24; color:#ffd4e1; font-size:11px; font-weight:800; cursor:pointer; }
        .messages-exit .app-icon { width:14px; }
        .messages-exit:hover { background:#412535; }
        @media (max-width: 760px) {
          .messages-sidebar.mobile-hidden { display: none !important; }
          .messages-chat.mobile-hidden { display: none !important; }
          .messages-sidebar { width: 100% !important; }
          .mobile-only { display: block !important; }
          .messages-exit-chat { font-size:0; min-width:36px; padding:7px; justify-content:center; }
          .messages-exit-chat .app-icon { width:16px; }
        }
        @media (min-width: 761px) {
          .mobile-only { display: none !important; }
        }
      `}</style>
    </Root>
  );
}
