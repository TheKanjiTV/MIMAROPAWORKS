import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { api } from '@/auth/api';
import { navigate } from '@/auth/navigation';
import type { SeekerConversation, SeekerMessage } from '@/types/seeker';

export function MessagingPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialConvId = urlParams.get('conversation') || '';

  const [conversations, setConversations] = useState<SeekerConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>(initialConvId);
  const [messages, setMessages] = useState<SeekerMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<SeekerConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api<{ conversations: SeekerConversation[] }>('/conversations')
      .then((res) => {
        if (!active) return;
        setConversations(res.conversations);
        setActiveConvId((current) => current || res.conversations[0]?.id || '');
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectConversation = (id: string) => {
    if (id === activeConvId) return;
    setError('');
    setMessages([]);
    setActiveConversation(null);
    setLoadingMessages(Boolean(id));
    setActiveConvId(id);
  };

  // Load active conversation messages
  useEffect(() => {
    if (!activeConvId) return;
    let active = true;
    api<{ conversation: SeekerConversation; messages: SeekerMessage[] }>(
      `/conversations/${encodeURIComponent(activeConvId)}/messages`,
    )
      .then((res) => {
        if (!active) return;
        setMessages(res.messages);
        setActiveConversation(res.conversation);
        // Clear unread count locally
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, unread_count: 0 } : c)),
        );
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [activeConvId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;

    setSending(true);
    const body = inputText.trim();
    try {
      const res = await api<{ message: SeekerMessage }>(
        `/conversations/${encodeURIComponent(activeConvId)}/messages`,
        { body },
      );
      setMessages((prev) => [...prev, res.message]);
      setInputText('');
      // Update snippet in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId ? { ...c, last_message: body, updated_at: Date.now() } : c,
        ),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('mimawork:toast', {
          detail: { message: err instanceof Error ? err.message : 'Could not send message.' },
        }),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {/* Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Messages</h1>
          <p className="text-xs text-slate-500">
            Professional communications regarding your job applications and employer inquiries.
          </p>
        </div>
      </section>

      {/* 2-Column Messaging Interface */}
      <div className="sw-card p-0 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[560px] border-slate-200 shadow-sm">
        {/* Left Column: Conversations List */}
        <div
          className={`md:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
            activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-slate-200 font-bold text-xs text-slate-700 uppercase tracking-wider bg-white">
            Conversations ({conversations.length})
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="sw-skeleton h-14 rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <MessageSquare size={32} className="mx-auto text-slate-300" />
                <p>No conversations yet.</p>
                <p className="text-xs text-slate-400">
                  When you apply to a job, you can message the hiring team from your application.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full text-left p-3.5 transition flex items-start justify-between gap-2 ${
                      isActive ? 'bg-teal-50/60 border-l-4 border-l-[#176b61]' : 'hover:bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {conv.other_name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(Number(conv.updated_at)).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-teal-800 truncate mb-1">
                        {conv.job_title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.last_message || 'No messages yet.'}
                      </p>
                    </div>

                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#176b61] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div
          className={`md:col-span-8 flex flex-col bg-white ${
            !activeConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => selectConversation('')}
                    className="md:hidden p-1 text-slate-500 hover:text-slate-800"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-teal-100 text-[#176b61] font-bold flex items-center justify-center text-xs">
                    {activeConversation.other_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900">
                      {activeConversation.other_name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Regarding: <strong>{activeConversation.job_title}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/applications')}
                  className="text-xs font-semibold text-[#176b61] hover:underline"
                >
                  View Application →
                </button>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fafbfc]">
                {loadingMessages ? (
                  <div className="space-y-2 p-4">
                    <div className="sw-skeleton h-10 w-2/3 ml-auto rounded-xl" />
                    <div className="sw-skeleton h-10 w-1/2 rounded-xl" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-xs text-slate-400">
                    <p>This conversation is open.</p>
                    <p className="text-xs mt-1">
                      Send a professional inquiry or update regarding your application.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.is_own ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md p-3 rounded-xl text-xs leading-relaxed ${
                          msg.is_own
                            ? 'bg-[#176b61] text-white rounded-br-none'
                            : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-none'
                        }`}
                      >
                        {msg.body}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {new Date(Number(msg.created_at)).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 flex items-center gap-2 bg-white"
              >
                <input
                  type="text"
                  placeholder="Type an employment message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  maxLength={2000}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal-600"
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="sw-btn sw-btn-primary sw-btn-sm py-2 px-3.5"
                >
                  <Send size={14} />
                  <span>{sending ? 'Sending…' : 'Send'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare size={40} className="mb-2 text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Select a conversation</h3>
              <p className="text-xs max-w-xs">
                Choose an employer conversation from the left to read and reply to messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
