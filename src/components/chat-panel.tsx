'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { LifeBuoy, MessageSquareText, Send, ShieldCheck, UserRound } from 'lucide-react';
import { updateThreadStatusAction } from '@/app/community/actions';

export type ChatThreadSummary = { id: string; name: string; subject: string; kind: string; preview: string; updatedAt: string; status: string };
export type ChatMessageView = { id: string; body: string; sender: string; senderId: string; createdAt: string };

export default function ChatPanel({ threads, me, initialThreadId, initialMessages = [], token, supportHref }: { threads: ChatThreadSummary[]; me: string; initialThreadId?: string; initialMessages?: ChatMessageView[]; token: string; supportHref?: string }) {
  const [activeId, setActiveId] = useState(initialThreadId || threads[0]?.id || '');
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = threads.find(t => t.id === activeId);

  const load = useCallback(async (threadId: string, quiet = false) => {
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

  useEffect(() => { if (activeId) load(activeId); }, [activeId, load]);
  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => load(activeId, true), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, load]);
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
      else { setDraft(''); await load(activeId, true); }
    } catch { setError('Message could not be sent. Check your connection.'); }
    finally { setSending(false); }
  }

  return <div className="chat-layout">
    <aside className="chat-threads" aria-label="Conversations">
      <div className="chat-threads-head"><span className="ws-eyebrow">CONVERSATIONS</span><strong>{threads.length}</strong></div>
      {threads.length ? threads.map(thread => <button type="button" key={thread.id} className={`chat-thread ${thread.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(thread.id)} aria-pressed={thread.id === activeId}>
        <span className={`chat-avatar ${thread.kind === 'support' ? 'support' : ''}`}>{thread.kind === 'support' ? <LifeBuoy size={17}/> : <UserRound size={17}/>}</span>
        <span className="chat-thread-copy"><strong>{thread.name}</strong><small>{thread.preview || thread.subject}</small><em>{thread.updatedAt}</em></span>
      </button>) : <div className="chat-threads-empty"><MessageSquareText size={22}/><p>No conversations yet.</p></div>}
      {supportHref && <a className="chat-support-link" href={supportHref}><LifeBuoy size={16}/> Message customer care</a>}
    </aside>
    <section className="chat-window">
      {active ? <>
        <header className="chat-window-head"><span className={`chat-avatar ${active.kind === 'support' ? 'support' : ''}`}>{active.kind === 'support' ? <LifeBuoy size={18}/> : <UserRound size={18}/>}</span><div><strong>{active.name}</strong><small>{active.kind === 'support' ? 'Customer care · Usually replies here' : active.subject}</small></div>{active.kind === 'support' && <span className="ws-badge open"><span/>{active.status}</span>}<form action={updateThreadStatusAction} className="chat-resolve-form"><input type="hidden" name="t" value={token}/><input type="hidden" name="threadId" value={active.id}/><input type="hidden" name="status" value={active.status === 'Resolved' ? 'Open' : 'Resolved'}/><button type="submit" className="chat-resolve-button">{active.status === 'Resolved' ? 'Reopen' : 'Resolve'}</button></form></header>
        <div className="chat-messages" ref={scrollRef} aria-live="polite">
          {loading && <p className="chat-note">Loading conversation…</p>}
          {!loading && !messages.length && <div className="chat-note"><ShieldCheck size={17}/><span>This is the start of your conversation. Keep personal details private and agree on scope before work begins.</span></div>}
          {messages.map(message => <div key={message.id} className={`chat-message ${message.senderId === me ? 'mine' : 'theirs'} ${message.sender === 'KUFIX Customer Care' ? 'care' : ''}`}><div className="chat-bubble">{message.body}</div><span className="chat-meta">{message.sender} · {new Date(message.createdAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>)}
        </div>
        {error && <p className="chat-error">{error}</p>}
        <form className="chat-composer" onSubmit={send}><label htmlFor="chat-body" className="chat-sr">Message</label><textarea id="chat-body" value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Message ${active.name}...`} maxLength={2000} rows={2}/><button className="ws-btn ws-btn-primary" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : <>Send <Send size={15}/></>}</button></form>
      </> : <div className="chat-window-empty"><span><MessageSquareText size={26}/></span><h2>Your messages live here</h2><p>Start a conversation from a professional’s profile, or message customer care for help with a booking.</p>{supportHref && <a className="ws-btn ws-btn-primary" href={supportHref}>Message customer care</a>}</div>}
    </section>
  </div>;
}
