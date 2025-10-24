// server.js
// Backend for SIP call + Smart Chat demo
// - Serves frontend static files
// - Socket.io chat with sentiment analysis
// - File upload endpoint using multer
// - Email/password login

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const multer = require("multer");
const Sentiment = require("sentiment");
const fs = require("fs");

// --- Basic setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Simple in-memory user database ---
const users = [
  { email: "user@example.com", password: "mypassword" }, // demo account
  { email: "24qm5a6701@gmail.com", password: "Prashanth@123" }
];

// Path helpers
const FRONTEND_DIR = path.join(__dirname, "../frontend");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("Created uploads directory:", UPLOADS_DIR);
}

// Serve frontend and uploaded files
app.use(express.static(FRONTEND_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

// Create HTTP server and Socket.io server
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // for development; tighten in production
});

// Sentiment analyzer instance
const sentiment = new Sentiment();

// In-memory chat history (demo only)
let chatHistory = [];

// ---------- File upload (multer) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// POST /api/upload
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ fileUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// POST /api/login
// Body: { email, password }
// Returns: { success: true } if valid, else { success: false, message }
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ success: false, message: "Email and password required" });
  }

  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    return res.json({ success: true });
  } else {
    return res.json({ success: false, message: "Invalid email or password" });
  }
});

// GET /api/chatHistory -> returns chat history (optional)
app.get("/api/chatHistory", (req, res) => {
  return res.json({ history: chatHistory });
});

// ---------- Socket.io chat ----------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // send existing chat history to the newly connected client
  socket.emit("chatHistory", chatHistory);

  // handle incoming chat message
  // expected msg: { sender, text, fileUrl?, timestamp? }
  socket.on("chatMessage", (msg) => {
    const safeMsg = {
      sender: msg.sender || "Anonymous",
      text: msg.text || "",
      fileUrl: msg.fileUrl || null,
      timestamp: msg.timestamp || new Date().toISOString()
    };

    // sentiment analysis on text
    try {
      const result = sentiment.analyze(safeMsg.text);
      safeMsg.sentiment = result.score;
    } catch (err) {
      safeMsg.sentiment = 0;
    }

    // store in history (in-memory)
    chatHistory.push(safeMsg);

    // broadcast to all connected clients
    io.emit("chatMessage", safeMsg);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Fallback route: root -> serve index.html (frontend must provide it)
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND_DIR}`);
  console.log(`Serving uploads from: ${UPLOADS_DIR}`);
});
