const { handleRoomEvents } = require("../socket/roomHandlers");

function initializeSocket(io) {
    io.on("connection", (socket) => {
        console.log("✓ Socket connected:", socket.id);

        handleRoomEvents(io, socket);

        socket.on("disconnect", (reason) => {
            console.log(`✗ Disconnected: ${socket.id} (${reason})`);
        });

        socket.on("error", (err) => console.error("Socket error:", err));
    });
}

module.exports = initializeSocket;
