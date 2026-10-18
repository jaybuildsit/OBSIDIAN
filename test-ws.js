import { io } from "socket.io-client";

const SANDBOX_ID = "01a1504e-7a95-702d-8df0-120e14ce681d";

const socket = io("http://localhost:8080", {
  path: "/socket.io",

  extraHeaders: {
    Host: `${SANDBOX_ID}.agent.localhost`,
  },

  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("\n=================================");
  console.log("🚀 OBSIDIAN TERMINAL TEST");
  console.log("=================================");

  console.log("🔥 SOCKET CONNECTED");
  console.log("Socket ID:", socket.id);
  console.log("Transport:", socket.io.engine.transport.name);

  console.log("\n📤 Sending: pwd");

  socket.emit("terminal-input", "echo OBSIDIAN_WORKING");
});

socket.on("terminal-output", (data) => {
  console.log("\n📟 TERMINAL OUTPUT");
  console.log("--------------------------------");

  console.log(data);

  console.log("--------------------------------");
});

socket.on("connect_error", (error) => {
  console.error("\n❌ CONNECTION ERROR");
  console.error(error.message);
});

socket.on("disconnect", (reason) => {
  console.log("\n🔌 SOCKET DISCONNECTED");
  console.log("Reason:", reason);
});
