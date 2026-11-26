'use client';

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { LifeBuoy, MessageSquareText, Send, UserRound } from 'lucide-react';
import { updateThreadStatusAction } from '@/app/community/actions';

export type ChatMessageView = { id: string; body: string; senderId: string | null; sender: string; createdAt: string };
export type ChatThreadSummary = { id: string; name: string; subject: string; kind: string; preview: string; updatedAt: string; status: string };

export default function ChatPanel({ threads, me, initialThreadId, initialMessages = [], token, supportHref }: { threads: ChatThreadSummary[]; me: string; initialThreadId?: string; initialMessages?: ChatMessageView[]; token: string; supportHref?: string }) {
  const [activeId, setActiveId] = useState(initialThreadId || threads[0]?.id || '');
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = threads.find(t => t.id === activeId);

  const fetchMessages = useCallback(async (threadId: string, quiet = false) => {
    if (!threadId) return;
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/chat/${threadId}${token ? `?t=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) { setMessages(json.messages); setError(''); }
      else if (!quiet) setError(json.error === 'unauthorized' ? 'Please log in again to load this conversation.' : 'This conversation is unavailable.');
    } catch { if (!quiet) setError('Could not load this conversation. Check your connection.'); }
    finally { if (!quiet) setLoading(false); }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    if (activeId) {
      fetch(`/api/chat/${activeId}${token ? `?t=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((json) => {
          if (!ignore && json.messages) {
            setMessages(json.messages);
            setError('');
          }
        })
        .catch(() => {
          if (!ignore) setError('Could not load this conversation. Check your connection.');
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [activeId, token]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => fetchMessages(activeId, true), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, fetchMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true); setError('');
    try {
      const res = await fetch(`/api/chat/${activeId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, t: token }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Message could not be sent.'); }
      else { setDraft(''); await fetchMessages(activeId, true); }
    } catch { setError('Message could not be sent. Check your connection.'); }
    finally { setSending(false); }
  }

  return <div className="chat-layout">
    <aside className="chat-threads">
      <div className="chat-threads-head">
        <span className="ws-eyebrow">CONVERSATIONS</span>
        <strong>{threads.length}</strong>
      </div>
      {threads.map(thread => <button key={thread.id} type="button" className={`chat-thread ${thread.id === activeId ? 'active' : ''}`} onClick={() => { setActiveId(thread.id); setError(''); }}>
        <span className={`chat-avatar ${thread.kind === 'support' ? 'support' : ''}`}>{thread.kind === 'support' ? <LifeBuoy size={17}/> : <UserRound size={17}/>}</span>
        <span className="chat-thread-copy"><strong>{thread.name}</strong><small>{thread.preview}</small><em>{thread.updatedAt}</em></span>
      </button>)}
      {supportHref && <a className="chat-support-link" href={supportHref}><LifeBuoy size={16}/> Message customer care</a>}
    </aside>
    <section className="chat-window">
      {active ? <>
        <header className="chat-window-head"><span className={`chat-avatar ${active.kind === 'support' ? 'support' : ''}`}>{active.kind === 'support' ? <LifeBuoy size={18}/> : <UserRound size={18}/>}</span><div><strong>{active.name}</strong><small>{active.kind === 'support' ? 'Customer care · Usually replies here' : active.subject}</small></div>{active.kind === 'support' && <span className="ws-badge open"><span/>{active.status}</span>}<form action={updateThreadStatusAction} className="chat-resolve-form"><input type="hidden" name="t" value={token}/><input type="hidden" name="threadId" value={active.id}/><input type="hidden" name="status" value={active.status === 'Resolved' ? 'Open' : 'Resolved'}/><button type="submit" className="chat-resolve-button">{active.status === 'Resolved' ? 'Reopen' : 'Resolve'}</button></form></header>
        <div className="chat-messages" ref={scrollRef}>
          {loading && !messages.length ? <div className="chat-loading">Loading conversation…</div> : null}
          {messages.map(message => <div key={message.id} className={`chat-message ${message.senderId === me ? 'mine' : 'theirs'}`}><div className="chat-bubble">{message.body}</div><span className="chat-meta">{message.sender} · {new Date(message.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span></div>)}
          {!loading && !messages.length ? <div className="chat-empty-thread">No messages yet. Send a message below to start this conversation.</div> : null}
        </div>
        {error ? <div className="chat-error">{error}</div> : null}
        <form className="chat-composer" onSubmit={send}>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Write a message…" rows={2} maxLength={2000}/>
          <button className="ws-btn ws-btn-primary" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'} <Send size={15}/></button>
        </form>
      </> : <div className="chat-window-empty"><span><MessageSquareText size={26}/></span><h2>Your messages live here</h2><p>Start a conversation from a professional’s profile, or message customer care for help with a booking.</p>{supportHref && <a className="ws-btn ws-btn-primary" href={supportHref}>Message customer care</a>}</div>}
    </section>
  </div>;
}
