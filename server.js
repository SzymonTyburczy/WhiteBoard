import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { MongoClient, ObjectId } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "whiteboard_app";
const BOARDS_COLLECTION = "boards";

let db = null;
const activeUsers = new Map();
const COLORS = [
	"#FF6B6B",
	"#4ECDC4",
	"#45B7D1",
	"#FFA07A",
	"#98D8C8",
	"#F7DC6F",
	"#BB8FCE",
	"#85C1E2",
];

// ─── Supabase Admin Client ────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceKey) {
	supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
	console.log("✓ Supabase admin client initialized");
} else {
	console.warn("⚠ Supabase not configured — auth disabled");
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: "Auth not configured" });
	}

	const token = req.headers.authorization?.replace("Bearer ", "");
	if (!token) {
		return res.status(401).json({ error: "Brak tokenu autoryzacji" });
	}

	try {
		const {
			data: { user },
			error,
		} = await supabaseAdmin.auth.getUser(token);
		if (error || !user) {
			return res.status(401).json({ error: "Nieprawidłowy token" });
		}
		req.user = user;
		next();
	} catch (err) {
		return res.status(401).json({ error: "Auth error" });
	}
}

async function optionalAuth(req, res, next) {
	if (!supabaseAdmin) {
		req.user = null;
		return next();
	}

	const token = req.headers.authorization?.replace("Bearer ", "");
	if (!token) {
		req.user = null;
		return next();
	}

	try {
		const {
			data: { user },
		} = await supabaseAdmin.auth.getUser(token);
		req.user = user || null;
	} catch {
		req.user = null;
	}
	next();
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// MongoDB Connection
async function connectDB() {
	try {
		const client = new MongoClient(MONGO_URI);
		await client.connect();
		db = client.db(DB_NAME);
		console.log("✓ Connected to MongoDB");

		// Create indexes
		const collection = db.collection(BOARDS_COLLECTION);
		await collection.createIndex({ createdAt: 1 });
		await collection.createIndex({ ownerId: 1 });
	} catch (err) {
		console.error("✗ MongoDB connection failed:", err.message);
		process.exit(1);
	}
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

// Config endpoint — serves Supabase public keys to frontend
app.get("/api/config", (req, res) => {
	res.json({
		supabaseUrl: supabaseUrl,
		supabaseAnonKey: supabaseAnonKey,
	});
});

// Get boards for authenticated user
app.get("/api/boards", requireAuth, async (req, res) => {
	try {
		const collection = db.collection(BOARDS_COLLECTION);
		const boards = await collection
			.find({ ownerId: req.user.id })
			.sort({ updatedAt: -1 })
			.project({ shapes: 0 })
			.toArray();
		res.json(boards);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Get single board with shapes — PUBLIC (for shareable links)
app.get("/api/boards/:id", async (req, res) => {
	try {
		const collection = db.collection(BOARDS_COLLECTION);
		const board = await collection.findOne({
			_id: new ObjectId(req.params.id),
		});
		if (!board) return res.status(404).json({ error: "Board not found" });
		res.json(board);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Create new board — requires auth
app.post("/api/boards", requireAuth, async (req, res) => {
	try {
		const { name } = req.body;
		if (!name) return res.status(400).json({ error: "Name required" });

		const collection = db.collection(BOARDS_COLLECTION);
		const board = {
			name,
			ownerId: req.user.id,
			ownerEmail: req.user.email,
			shapes: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const result = await collection.insertOne(board);
		res.status(201).json({ ...board, _id: result.insertedId });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Update board (save shapes) — PUBLIC (anyone with link can draw)
app.put("/api/boards/:id", async (req, res) => {
	try {
		const { shapes } = req.body;
		const collection = db.collection(BOARDS_COLLECTION);

		const result = await collection.updateOne(
			{ _id: new ObjectId(req.params.id) },
			{
				$set: {
					shapes: shapes || [],
					updatedAt: new Date(),
				},
			},
		);

		if (result.matchedCount === 0)
			return res.status(404).json({ error: "Board not found" });
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Delete board — requires auth + ownership
app.delete("/api/boards/:id", requireAuth, async (req, res) => {
	try {
		const collection = db.collection(BOARDS_COLLECTION);
		const board = await collection.findOne({
			_id: new ObjectId(req.params.id),
		});

		if (!board) return res.status(404).json({ error: "Board not found" });
		if (board.ownerId !== req.user.id) {
			return res.status(403).json({ error: "Brak uprawnień" });
		}

		await collection.deleteOne({ _id: new ObjectId(req.params.id) });
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Health check
app.get("/api/health", (req, res) => {
	res.json({ status: "ok" });
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────

app.get("/dashboard", (req, res) => {
	res.sendFile(join(__dirname, "public", "index.html"));
});

app.get("/board/:id", (req, res) => {
	res.sendFile(join(__dirname, "public", "index.html"));
});

// ─── WebSocket Real-time Events ────────────────────────────────────────────────

io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);

	// User joins a board
	socket.on("join-board", ({ boardId, nickname }) => {
		socket.join(boardId);

		if (!activeUsers.has(boardId)) {
			activeUsers.set(boardId, []);
		}

		const color = COLORS[activeUsers.get(boardId).length % COLORS.length];
		const userInfo = { socketId: socket.id, nickname, color };
		activeUsers.get(boardId).push(userInfo);

		// Notify everyone on board
		io.to(boardId).emit("user-joined", {
			users: activeUsers.get(boardId),
			nickname,
			color,
		});

		console.log(`${nickname} joined board ${boardId}`);
	});

	// Real-time drawing
	socket.on("draw", ({ boardId, shape }) => {
		socket.to(boardId).emit("shape-drawn", shape);
	});

	// Undo
	socket.on("undo", ({ boardId }) => {
		socket.to(boardId).emit("undo-action");
	});

	// Redo
	socket.on("redo", ({ boardId }) => {
		socket.to(boardId).emit("redo-action");
	});

	// Clear board
	socket.on("clear-board", ({ boardId }) => {
		socket.to(boardId).emit("board-cleared");
	});

	// User disconnects
	socket.on("disconnect", () => {
		// Remove user from all boards
		for (const [boardId, users] of activeUsers.entries()) {
			const idx = users.findIndex((u) => u.socketId === socket.id);
			if (idx !== -1) {
				const nickname = users[idx].nickname;
				users.splice(idx, 1);
				io.to(boardId).emit("user-left", {
					nickname,
					users: users,
				});
				console.log(`${nickname} left board ${boardId}`);
			}
		}
	});
});

// Start server
async function start() {
	await connectDB();
	httpServer.listen(PORT, () => {
		console.log(`🚀 Server running on port ${PORT}`);
	});
}

start();
