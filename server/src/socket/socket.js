socket.on("conversation:leave", ({ room }) => {
  if (!room) return;
  socket.leave(room);
});