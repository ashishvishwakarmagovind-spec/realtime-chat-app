import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Search, MoreVertical, ArrowLeft, Video, Phone,
  Mic, Square, Paperclip, Send, Pin, Plus, X,
  Moon, Sun, Download, Image as ImageIcon,
  Reply, Edit2, Trash2, LogOut, Users
} from "lucide-react";
import logo from "../assets/logo.png";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── helpers ──────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Always returns a plain string ID regardless of whether it's an ObjectId, plain string, or object
const toId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val._id ? String(val._id) : String(val);
  return String(val);
};

export default function ChatLayout() {
  const navigate   = useNavigate();
  const [user]     = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  // ── state ───────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeConv,    setActiveConv]    = useState(null); // full conv object
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState("");
  const [searchQ,       setSearchQ]       = useState("");
  const [searchRes,     setSearchRes]     = useState([]);
  const [onlineIds,     setOnlineIds]     = useState([]);
  const [typing,        setTyping]        = useState({});   // convId → bool
  const [tab,           setTab]           = useState("All Chats");
  const [theme,         setTheme]         = useState(localStorage.getItem("theme") || "light");

  // modals & features
  const [showNewChat,    setShowNewChat]    = useState(false);
  const [newChatPhone,   setNewChatPhone]   = useState("");
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [groupName,      setGroupName]      = useState("");
  const [selectedUsers,  setSelectedUsers]  = useState([]);
  const [replyingTo,     setReplyingTo]     = useState(null);
  const [editingMsg,     setEditingMsg]     = useState(null);
  const [incomingCall,   setIncomingCall]   = useState(null);
  const [isRecording,    setIsRecording]    = useState(false);

  // refs
  const socketRef       = useRef(null);
  const activeConvRef   = useRef(null);
  const bottomRef       = useRef(null);
  const fileRef         = useRef(null);
  const imageRef        = useRef(null);
  const mediaRecRef     = useRef(null);
  const audioChunksRef  = useRef([]);
  const typingTimer     = useRef(null);

  // keep ref in sync
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  // ── theme ────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ── redirect if no user ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.token) navigate("/login");
  }, [user, navigate]);

  // ── socket setup (runs once) ─────────────────────────────────────
  useEffect(() => {
    if (!user?.token) return;

    const sock = io(API, {
      auth:        { token: user.token },
      autoConnect: true,
      reconnection: true
    });
    socketRef.current = sock;

    sock.on("connect", () => console.log("[socket] connected:", sock.id));
    sock.on("connect_error", (e) => console.error("[socket] auth error:", e.message));

    sock.on("presence:update", (ids) => setOnlineIds(ids));

    sock.on("message:new", (msg) => {
      const msgConvId = toId(msg.conversationId);
      const curConvId = activeConvRef.current ? toId(activeConvRef.current._id) : "";
      
      if (curConvId && msgConvId === curConvId) {
        setMessages((prev) => {
          // 1. If message already exists (by ID), just update it
          const exists = prev.find(m => m._id === msg._id);
          if (exists) return prev.map(m => m._id === msg._id ? msg : m);

          // 2. Otherwise, check for a matching optimistic (temp) message
          // A match is same text from same sender
          const senderId = toId(msg.senderId);
          const tempMatch = prev.find(m => m._tempId && m.text === msg.text && toId(m.senderId) === senderId);
          
          if (tempMatch) {
            // Replace the temp message with the real one
            return prev.map(m => m._id === tempMatch._id ? msg : m);
          }

          // 3. Just append the new message
          return [...prev, msg];
        });
      }
      // refresh sidebar
      loadConversations();
    });

    sock.on("message:updated", (msg) => {
      const msgConvId = toId(msg.conversationId);
      const curConvId = activeConvRef.current ? toId(activeConvRef.current._id) : "";
      if (curConvId && msgConvId === curConvId) {
        setMessages((prev) => prev.map(m => m._id === msg._id ? msg : m));
      }
    });

    sock.on("message:deleted", (msg) => {
      const msgConvId = toId(msg.conversationId);
      const curConvId = activeConvRef.current ? toId(activeConvRef.current._id) : "";
      if (curConvId && msgConvId === curConvId) {
        setMessages((prev) => prev.map(m => m._id === msg._id ? msg : m));
      }
    });

    sock.on("typing:start", ({ conversationId }) =>
      setTyping(p => ({ ...p, [conversationId]: true })));
    sock.on("typing:stop", ({ conversationId }) =>
      setTyping(p => { const n = { ...p }; delete n[conversationId]; return n; }));

    sock.on("call:incoming",  (data) => setIncomingCall(data));
    sock.on("call:accepted",  ()     => alert("Call accepted! (WebRTC not implemented)"));
    sock.on("call:rejected",  ()     => alert("Call rejected"));

    return () => sock.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  // ── API helpers ──────────────────────────────────────────────────
  const authHeaders = { Authorization: `Bearer ${user?.token}` };

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/conversations`, { headers: authHeaders });
      setConversations(data);
    } catch (e) { console.error("loadConversations:", e.message); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openConversation = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setReplyingTo(null);
    setEditingMsg(null);
    setText("");
    socketRef.current?.emit("conversation:join", { conversationId: conv._id });
    
    try {
      const { data } = await axios.get(`${API}/api/messages/${conv._id}`, { headers: authHeaders });
      // Use functional update to ensure we don't wipe out messages that arrived via socket while we were fetching
      setMessages(prev => {
        // Create a map of existing messages by ID to avoid duplicates
        const msgMap = new Map();
        data.forEach(m => msgMap.set(m._id, m));
        prev.forEach(m => {
          if (!m._tempId) msgMap.set(m._id, m);
          else msgMap.set(m._id, m); // Keep temp messages too
        });
        return Array.from(msgMap.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    } catch (e) { console.error("loadMessages:", e.message); }
  };

  // scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── name / status helpers ────────────────────────────────────────
  const getChatName = (conv) => {
    if (!conv) return "";
    if (conv.isGroup) return conv.name || "Group";
    const other = conv.members?.find(m => (m._id || m) !== user._id);
    return other?.name || "Unknown";
  };

  const isOnline = (conv) => {
    if (!conv || conv.isGroup) return false;
    const other = conv.members?.find(m => (m._id || m) !== user._id);
    return other && onlineIds.includes(other._id || other);
  };

  // ── send message ─────────────────────────────────────────────────
  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!activeConv) return;

    if (editingMsg) {
      try {
        const { data } = await axios.put(`${API}/api/messages/${editingMsg._id}`, { text: trimmed }, { headers: authHeaders });
        socketRef.current?.emit("message:update", { conversationId: activeConv._id, message: data });
        // Optimistically update self
        setMessages(prev => prev.map(m => m._id === data._id ? data : m));
      } catch { alert("Edit failed"); }
      setEditingMsg(null); setText(""); return;
    }

    if (!trimmed) return;

    // Optimistic update - show message immediately for sender
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      _tempId: true,
      conversationId: activeConv._id,
      senderId: { _id: user._id, name: user.name },
      type: "text",
      text: trimmed,
      replyTo: replyingTo ? { ...replyingTo } : null,
      isDeleted: false,
      isEdited: false,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    socketRef.current?.emit("message:send", {
      conversationId: activeConv._id,
      text:    trimmed,
      replyTo: replyingTo?._id || null
    });
    setText(""); setReplyingTo(null);
    clearTimeout(typingTimer.current);
    socketRef.current?.emit("typing:stop", { conversationId: activeConv._id });
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (!activeConv) return;
    socketRef.current?.emit("typing:start", { conversationId: activeConv._id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() =>
      socketRef.current?.emit("typing:stop", { conversationId: activeConv._id }), 1500);
  };

  const deleteMsgHandler = async (msgId) => {
    try {
      const { data } = await axios.delete(`${API}/api/messages/${msgId}`, { headers: authHeaders });
      socketRef.current?.emit("message:delete", { conversationId: activeConv._id, message: data });
    } catch { alert("Delete failed"); }
  };

  // ── file upload ───────────────────────────────────────────────────
  const uploadFile = async (file) => {
    if (!file || !activeConv) return;
    const fd = new FormData();
    fd.append("attachment", file);
    try {
      const { data } = await axios.post(`${API}/api/messages/${activeConv._id}/attach`, fd, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" }
      });
      // inject into local state immediately
      setMessages(prev => [...prev, data]);
      loadConversations();
    } catch { alert("Upload failed"); }
  };

  // ── audio recording ───────────────────────────────────────────────
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      mr.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        uploadFile(new File([blob], "audio.webm", { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setIsRecording(true);
    } catch { alert("Microphone permission denied"); }
  };

  const stopRec = () => {
    if (mediaRecRef.current && isRecording) {
      mediaRecRef.current.stop();
      setIsRecording(false);
    }
  };

  // ── new chat by phone ─────────────────────────────────────────────
  const handleNewChat = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/api/conversations/direct-by-phone`,
        { phone: newChatPhone }, { headers: authHeaders });
      const conv = data.chat;
      setShowNewChat(false); setNewChatPhone(""); loadConversations();
      openConversation(conv);
      if (data.isNew) {
        socketRef.current?.emit("message:send", { conversationId: conv._id, text: "Hi" });
      }
    } catch (e) { alert(e.response?.data?.message || "User not found"); }
  };

  // ── group creation ────────────────────────────────────────────────
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUsers.length === 0) {
      return alert("Please enter group name and select at least one member");
    }
    try {
      const { data } = await axios.post(`${API}/api/conversations`, {
        name: groupName,
        isGroup: true,
        members: selectedUsers.map(u => u._id)
      }, { headers: authHeaders });
      
      setShowNewGroup(false);
      setGroupName("");
      setSelectedUsers([]);
      loadConversations();
      openConversation(data);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to create group");
    }
  };

  const toggleUserSelection = (u) => {
    if (selectedUsers.find(user => user._id === u._id)) {
      setSelectedUsers(selectedUsers.filter(user => user._id !== u._id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  // ── search users ───────────────────────────────────────────────────
  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQ(q);
    if (!q) return setSearchRes([]);
    try {
      const { data } = await axios.get(`${API}/api/users/search?q=${q}`, { headers: authHeaders });
      setSearchRes(data);
    } catch { setSearchRes([]); }
  };

  const openDirectChat = async (uid) => {
    try {
      const { data } = await axios.post(`${API}/api/conversations`,
        { userId: uid }, { headers: authHeaders });
      setSearchQ(""); setSearchRes([]);
      openConversation(data);
      loadConversations();
    } catch { alert("Failed to open chat"); }
  };

  // ── delete conversation ───────────────────────────────────────────
  const deleteConv = async () => {
    if (!activeConv || !window.confirm("Delete this chat for everyone?")) return;
    try {
      await axios.delete(`${API}/api/conversations/${activeConv._id}`, { headers: authHeaders });
      setActiveConv(null); setMessages([]); loadConversations();
    } catch { alert("Delete failed"); }
  };

  // ── call ────────────────────────────────────────────────────────
  const requestCall = (type) => {
    if (!activeConv) return;
    socketRef.current?.emit("call:request", { conversationId: activeConv._id, type });
  };

  // ── filtered list ─────────────────────────────────────────────────
  const filteredConvs = () => {
    if (tab === "Groups")   return conversations.filter(c => c.isGroup);
    if (tab === "Contacts") return conversations.filter(c => !c.isGroup);
    if (tab === "Calls")    return [];
    return conversations;
  };

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="layout">

      {/* ════════ SIDEBAR ════════ */}
      <div className={`sidebar ${activeConv ? "mobile-hidden" : ""}`}>

        <div className="sidebar-header">
          <div className="greeting">
            <span className="greeting-hello">Hello,</span>
            <h2 className="greeting-name">{user?.name}</h2>
          </div>
          <div className="header-actions">
            <button className="circle-btn" onClick={() => document.getElementById("sideSearch").focus()}>
              <Search size={18}/>
            </button>
            <button className="circle-btn" title="Logout" onClick={() => {
              localStorage.clear(); navigate("/login");
            }}>
              <LogOut size={18}/>
            </button>
          </div>
        </div>

        <div className="search-bar" style={{ display: "block" }}>
          <input
            id="sideSearch"
            placeholder="Search by name or phone…"
            value={searchQ}
            onChange={handleSearch}
          />
        </div>

        <div className="action-buttons" style={{ display:"flex", gap:"0.5rem" }}>
          <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowNewChat(true)}>
            <Plus size={16}/> New Chat
          </button>
          <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowNewGroup(true)}>
            <Users size={16}/> New Group
          </button>
        </div>

        <div className="tabs">
          {["All Chats","Groups","Contacts","Calls"].map(t => (
            <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="conversation-list">
          {tab === "Calls" ? (
            <p style={{ textAlign:"center", color:"var(--text-muted)", marginTop:"2rem" }}>No recent calls</p>
          ) : searchRes.length > 0 ? (
            searchRes.map(u => (
              <div key={u._id} className="conversation-item" onClick={() => openDirectChat(u._id)}>
                <div className="avatar-wrapper">
                  <div className="avatar">{u.name[0].toUpperCase()}</div>
                </div>
                <div className="details">
                  <div className="details-top"><h4>{u.name}</h4></div>
                  <div className="details-bottom"><p>{u.phone || u.email}</p></div>
                </div>
              </div>
            ))
          ) : (
            filteredConvs().map((c, i) => {
              const name     = getChatName(c);
              const isTyp    = typing[c._id];
              return (
                <div
                  key={c._id}
                  className={`conversation-item ${activeConv?._id === c._id ? "active" : ""}`}
                  onClick={() => openConversation(c)}
                >
                  <div className="avatar-wrapper">
                    <div className="avatar">{name[0]?.toUpperCase()}</div>
                    {isOnline(c) && <div className="online-dot"/>}
                  </div>
                  <div className="details">
                    <div className="details-top">
                      <h4>{name} {i===0 && <Pin size={12} className="pin-icon"/>}</h4>
                      <span className="time">{fmt(c.lastMessageAt || c.updatedAt)}</span>
                    </div>
                    <div className="details-bottom">
                      <p className={isTyp ? "typing-text" : ""}>
                        {isTyp ? "typing…" : (c.lastMessage || "Tap to chat")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ════════ CHAT PANEL ════════ */}
      <div className={`chat-panel ${!activeConv ? "mobile-hidden" : ""}`}>
        {activeConv ? (
          <>
            {/* header */}
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConv(null)}><ArrowLeft size={20}/></button>
              <div className="chat-header-profile">
                <div className="avatar-small">{getChatName(activeConv)[0]?.toUpperCase()}</div>
                <div className="chat-header-info">
                  <h3>{getChatName(activeConv)}</h3>
                  <span className="status-text">{isOnline(activeConv) ? "Online" : "Offline"}</span>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="circle-btn-white" title="Delete Chat" onClick={deleteConv}><Trash2 size={16}/></button>
                <button className="circle-btn-white" onClick={() => requestCall("video")}><Video size={16}/></button>
                <button className="circle-btn-white" onClick={() => requestCall("audio")}><Phone size={16}/></button>
                <button className="circle-btn-white" onClick={() => setTheme(t => t==="light"?"dark":"light")}>
                  {theme==="light" ? <Moon size={16}/> : <Sun size={16}/>}
                </button>
              </div>
            </div>

            {/* messages */}
            <div className="messages-area">
              {messages.length === 0 && (
                <div style={{ textAlign:"center", color:"rgba(255,255,255,0.5)", marginTop:"2rem" }}>
                  No messages yet. Say hi!
                </div>
              )}
              {messages.map(m => {
                const isMe = (m.senderId?._id || m.senderId) === user._id;
                const isAudio = m.type === "audio" || m.attachment?.filename?.endsWith(".webm");
                return (
                  <div key={m._id} className={`message-row ${isMe?"me":"them"}`}>
                    {!m.isDeleted && (
                      <div className="message-actions">
                        <button className="action-icon" title="Reply" onClick={() => setReplyingTo(m)}><Reply size={14}/></button>
                        {isMe && <>
                          <button className="action-icon" title="Edit" onClick={() => { setEditingMsg(m); setText(m.text); }}><Edit2 size={14}/></button>
                          <button className="action-icon delete" title="Delete" onClick={() => deleteMsgHandler(m._id)}><Trash2 size={14}/></button>
                        </>}
                      </div>
                    )}
                    <div className="bubble">
                      {/* reply preview */}
                      {m.replyTo && !m.isDeleted && (
                        <div className="replied-to-bubble">
                          <strong>{m.replyTo.senderId?.name || "Them"}: </strong>{m.replyTo.text}
                        </div>
                      )}
                      {m.isDeleted ? (
                        <div className="bubble-text" style={{ fontStyle:"italic", opacity:0.5 }}>This message was deleted</div>
                      ) : (
                        <>
                          {m.type==="image" && m.attachment && (
                            <img src={`${API}${m.attachment.url}`} alt="img" className="bubble-image"/>
                          )}
                          {m.type==="file" && !isAudio && m.attachment && (
                            <div className="bubble-file">
                              <Download size={14}/>
                              <a href={`${API}${m.attachment.url}`} download target="_blank" rel="noreferrer">{m.attachment.filename}</a>
                            </div>
                          )}
                          {isAudio && m.attachment && (
                            <audio controls className="audio-player">
                              <source src={`${API}${m.attachment.url}`} type="audio/webm"/>
                            </audio>
                          )}
                          {m.text && (
                            <div className="bubble-text">
                              {m.text}
                              {m.isEdited && <span className="edited-tag"> (edited)</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {typing[activeConv._id] && (
                <div className="message-row them typing-row">
                  <div className="bubble typing-bubble">
                    <span className="dot"/><span className="dot"/><span className="dot"/>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* input */}
            <div className="input-area" style={{ flexDirection:"column", gap:"0.5rem", alignItems:"stretch" }}>
              {replyingTo && (
                <div className="reply-preview-container">
                  <div className="reply-preview-text">
                    <strong>Replying to {replyingTo.senderId?.name || "Them"}: </strong>{replyingTo.text}
                  </div>
                  <button className="reply-close" onClick={() => setReplyingTo(null)}><X size={16}/></button>
                </div>
              )}
              {editingMsg && (
                <div className="reply-preview-container">
                  <div className="reply-preview-text"><strong>Editing message…</strong></div>
                  <button className="reply-close" onClick={() => { setEditingMsg(null); setText(""); }}><X size={16}/></button>
                </div>
              )}

              <div style={{ display:"flex", gap:"0.8rem", alignItems:"center" }}>
                <input type="file" accept="image/*" style={{ display:"none" }} ref={imageRef} onChange={e => uploadFile(e.target.files[0])}/>
                <input type="file" style={{ display:"none" }} ref={fileRef}  onChange={e => uploadFile(e.target.files[0])}/>

                <div className="input-container">
                  <button className="icon-btn-transparent" onClick={() => imageRef.current?.click()}><ImageIcon size={20}/></button>
                  <button className="icon-btn-transparent" onClick={() => fileRef.current?.click()}><Paperclip size={20}/></button>
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                  />
                </div>

                {text.trim() || editingMsg ? (
                  <button className="btn-send-circle" onClick={sendMessage}><Send size={18}/></button>
                ) : (
                  <button
                    className="btn-send-circle"
                    style={{ background: isRecording ? "#FF3B30" : "#FFF" }}
                    onMouseDown={startRec} onMouseUp={stopRec} onMouseLeave={stopRec}
                    onTouchStart={startRec} onTouchEnd={stopRec}
                    title="Hold to record"
                  >
                    {isRecording ? <Square size={18} fill="white" color="white"/> : <Mic size={18} style={{ color:"var(--primary)" }}/>}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <img src={logo} alt="Logo" className="empty-logo"/>
            <h2>Realtime Chat</h2>
            <p>Select a conversation from the left to start chatting.</p>
          </div>
        )}
      </div>

      {/* ════════ INCOMING CALL MODAL ════════ */}
      {incomingCall && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign:"center" }}>
            <h2>📞 Incoming {incomingCall.type} Call</h2>
            <p style={{ margin:"1rem 0" }}>{incomingCall.callerName} is calling you</p>
            <div style={{ display:"flex", gap:"1rem" }}>
              <button className="btn-primary" style={{ background:"#34C759" }}
                onClick={() => { socketRef.current?.emit("call:accept",{conversationId:incomingCall.conversationId}); setIncomingCall(null); }}>
                Accept
              </button>
              <button className="btn-primary" style={{ background:"#FF3B30" }}
                onClick={() => { socketRef.current?.emit("call:reject",{conversationId:incomingCall.conversationId}); setIncomingCall(null); }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ NEW CHAT MODAL ════════ */}
      {showNewChat && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowNewChat(false)}><X size={20}/></button>
            <h2>Start New Chat</h2>
            <form onSubmit={handleNewChat} className="modal-form">
              <input
                type="text" required
                placeholder="Friend's Phone Number"
                value={newChatPhone}
                onChange={e => setNewChatPhone(e.target.value)}
              />
              <button type="submit" className="btn-primary">Start Chat</button>
            </form>
          </div>
        </div>
      )}
      {/* ════════ NEW GROUP MODAL ════════ */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Group</h2>
              <button onClick={() => setShowNewGroup(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Name</label>
                <input
                  type="text"
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-[#5E5CE6] transition-all dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Members ({selectedUsers.length})
                </label>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQ}
                    onChange={handleSearch}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-[#5E5CE6] transition-all dark:text-white"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {(searchRes.length > 0 ? searchRes : []).map(u => {
                    const isSelected = selectedUsers.find(user => user._id === u._id);
                    return (
                      <div 
                        key={u._id} 
                        onClick={() => toggleUserSelection(u)}
                        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                          isSelected ? 'bg-[#5E5CE6]/10 border border-[#5E5CE6]/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5E5CE6] to-[#706EE6] flex items-center justify-center text-white font-bold">
                          {u.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.phone}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-[#5E5CE6] border-[#5E5CE6]' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Plus size={14} className="text-white rotate-45" />}
                        </div>
                      </div>
                    );
                  })}
                  {searchQ && searchRes.length === 0 && (
                    <p className="text-center text-sm text-gray-500 py-4">No users found</p>
                  )}
                  {!searchQ && (
                    <p className="text-center text-sm text-gray-400 py-4">Search to add members</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-[#1C1C1E]/50 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0}
                className="w-full py-4 bg-[#5E5CE6] hover:bg-[#4E4CD6] disabled:opacity-50 disabled:hover:bg-[#5E5CE6] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#5E5CE6]/20"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
