import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { socket } from "./socket";
import "./App.css";
import logo from "./assets/logo.png";

export default function App() {
  const API = import.meta.env.VITE_API_URL;

  const [room, setRoom] = useState("general");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [me, setMe] = useState(() => localStorage.getItem("chat_name") || "Ashish");

  const bottomRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chat_name", me);
  }, [me]);

  useEffect(() => {
    const onConnect = () => console.log("socket connected:", socket.id);
    const onNewMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const onMessageError = (e) => alert(e?.message || "Message send failed");

    socket.on("connect", onConnect);
    socket.on("message:new", onNewMessage);
    socket.on("message:error", onMessageError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("message:new", onNewMessage);
      socket.off("message:error", onMessageError);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const joinRoom = async () => {
    const nextRoom = room.trim();
    if (!nextRoom) return;

    if (joinedRoom) socket.emit("conversation:leave", { room: joinedRoom });

    setJoinedRoom(nextRoom);
    socket.emit("conversation:join", { room: nextRoom });

    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API}/api/messages`, {
        params: { room: nextRoom, limit: 200 },
      });
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load history:", err);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const send = () => {
    if (!joinedRoom || !text.trim()) return;

    socket.emit("message:send", {
      room: joinedRoom,
      text,
      sender: me,
    });

    setText("");
  };

  return (
    <div className="page">
      <div className="chatShell">
        <div className="chatHeader">
          <div className="brand">
            <img className="brandLogo" src={logo} alt="Logo" />
            <div>
              <div className="brandTitle">Realtime Chat</div>
              <div className="brandSub">
                {joinedRoom ? `Room: ${joinedRoom}` : "Join a room to start chatting"}
              </div>
            </div>
          </div>

          <div className="headerRight">
            <span style={{ opacity: 0.8 }}>Name:</span>
            <input className="inputSmall" value={me} onChange={(e) => setMe(e.target.value)} />
          </div>
        </div>

        <div className="joinBar">
          <div className="joinLeft">
            <input
              className="inputSmall"
              style={{ width: 220 }}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="room name (general)"
            />
            <button className="btn" onClick={joinRoom}>
              Join
            </button>
          </div>

          <div style={{ color: "rgba(226,232,240,0.7)", fontSize: 12 }}>
            Server: {API}
          </div>
        </div>

        <div className="messages">
          {!joinedRoom ? (
            <div className="centerNote">
              Join a room (example: <b>general</b>) to load history and chat.
            </div>
          ) : loadingHistory ? (
            <div className="centerNote">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="centerNote">No messages yet. Say hello.</div>
          ) : (
            messages.map((m) => {
              const mine = (m.sender || "guest") === me;
              return (
                <div key={m._id || `${m.text}-${m.createdAt}`} className={`row ${mine ? "mine" : "other"}`}>
                  <div className={`bubble ${mine ? "mine" : ""}`}>
                    <div className="meta">
                      {mine ? "You" : m.sender || "guest"}
                      {m.createdAt ? ` • ${new Date(m.createdAt).toLocaleTimeString()}` : ""}
                    </div>
                    <div className="text">{m.text}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="inputBar">
          <input
            className="inputBig"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!joinedRoom}
            placeholder={joinedRoom ? "Type a message..." : "Join a room first"}
          />
          <button className="btn" onClick={send} disabled={!joinedRoom}>
            Send
          </button>
        </div>

        <div className="hint">Tip: Press <b>Enter</b> to send.</div>
      </div>
    </div>
  );
}