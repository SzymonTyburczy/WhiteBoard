// ─── STATE ──────────────────────────────────────────────────────────
let supabase = null;
let session = null;
let socket = null;

let currentBoardId = null;
let currentNickname = "Gość";
let activeUsers = [];

// Drawing State
let shapes = [];
let undoHistory = [];
let redoHistory = [];
let activeTool = "pen";
let activeColor = "#ffffff";
let strokeWidth = 2;

let drawing = false;
let startPos = null;
let current = null;
let dirty = true;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let W, H;

// ─── INIT & CONFIG ──────────────────────────────────────────────────
async function init() {
	// Fetch Supabase config from backend
	try {
		const res = await fetch("/api/config");
		const config = await res.json();
		
		if (config.supabaseUrl && config.supabaseAnonKey) {
			supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
			const { data } = await supabase.auth.getSession();
			session = data.session;
			
			supabase.auth.onAuthStateChange((event, _session) => {
				session = _session;
				handleRoute();
			});
		} else {
			console.warn("Supabase not configured. Auth disabled.");
		}
	} catch (err) {
		console.error("Config load error:", err);
	}

	window.addEventListener("popstate", handleRoute);
	window.addEventListener("resize", () => {
		if (document.getElementById("board-screen").classList.contains("active")) {
			resize();
		}
	});

	handleRoute();
}

// ─── ROUTING ────────────────────────────────────────────────────────
function showScreen(id) {
	document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
	document.getElementById(id).classList.add("active");
}

async function handleRoute() {
	const path = window.location.pathname;

	// Close modals
	document.getElementById("guest-overlay").classList.remove("active");
	
	if (path.startsWith("/board/")) {
		const boardId = path.split("/")[2];
		await joinBoard(boardId);
	} else if (path === "/dashboard" || path === "/") {
		if (session) {
			window.history.replaceState({}, "", "/dashboard");
			currentNickname = session.user.email.split("@")[0];
			showScreen("dashboard-screen");
			document.getElementById("dash-email").textContent = session.user.email;
			loadBoards();
		} else {
			window.history.replaceState({}, "", "/");
			showScreen("auth-screen");
		}
	}
}

function goHome() {
	if (socket) socket.disconnect();
	window.history.pushState({}, "", "/dashboard");
	handleRoute();
}

// ─── AUTHENTICATION ─────────────────────────────────────────────────
let isLoginMode = true;

document.getElementById("auth-toggle").addEventListener("click", () => {
	isLoginMode = !isLoginMode;
	document.getElementById("auth-subtitle").textContent = isLoginMode ? "Zaloguj się do swoich tablic" : "Utwórz nowe konto";
	document.getElementById("auth-form").querySelector("button").textContent = isLoginMode ? "Zaloguj się" : "Zarejestruj się";
	document.getElementById("auth-toggle").textContent = isLoginMode ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się";
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	if (!supabase) return toast("Auth error: Supabase not initialized");

	const email = document.getElementById("auth-email").value;
	const password = document.getElementById("auth-password").value;

	try {
		if (isLoginMode) {
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
		} else {
			const { error } = await supabase.auth.signUp({ email, password });
			if (error) throw error;
			toast("Konto utworzone! Możesz się zalogować.");
			isLoginMode = true;
			document.getElementById("auth-toggle").click(); // Toggle back to login visually
		}
	} catch (err) {
		toast("Błąd: " + err.message);
	}
});

async function logout() {
	if (supabase) await supabase.auth.signOut();
}

function authHeaders() {
	if (!session) return {};
	return { "Authorization": `Bearer ${session.access_token}` };
}

// ─── DASHBOARD ──────────────────────────────────────────────────────
async function loadBoards() {
	try {
		const res = await fetch("/api/boards", { headers: authHeaders() });
		const boards = await res.json();
		
		const grid = document.getElementById("boards-grid");
		// Keep the first element (New Board button)
		const newBtn = grid.firstElementChild;
		grid.innerHTML = "";
		grid.appendChild(newBtn);

		boards.forEach(board => {
			const card = document.createElement("div");
			card.className = "board-card";
			const date = new Date(board.updatedAt).toLocaleDateString("pl-PL");
			card.innerHTML = `
				<h3>${board.name}</h3>
				<p>Zaktualizowano: ${date}</p>
				<div class="board-actions">
					<button class="btn btn-primary" style="flex:1" onclick="openBoard('${board._id}')">Otwórz</button>
					<button class="btn btn-danger" onclick="deleteBoard('${board._id}', event)">Usuń</button>
				</div>
			`;
			grid.appendChild(card);
		});
	} catch (err) {
		console.error("Failed to load boards:", err);
	}
}

async function createBoard() {
	const name = prompt("Nazwa nowej tablicy:", "Nowa Tablica");
	if (!name) return;

	try {
		const res = await fetch("/api/boards", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders() },
			body: JSON.stringify({ name })
		});
		if (res.ok) {
			const board = await res.json();
			openBoard(board._id);
		}
	} catch (err) {
		toast("Błąd tworzenia tablicy");
	}
}

async function deleteBoard(id, event) {
	event.stopPropagation();
	if (!confirm("Na pewno usunąć?")) return;

	try {
		const res = await fetch(`/api/boards/${id}`, {
			method: "DELETE",
			headers: authHeaders()
		});
		if (res.ok) {
			toast("Tablica usunięta");
			loadBoards();
		} else {
			const data = await res.json();
			toast(data.error || "Błąd usuwania");
		}
	} catch (err) {
		toast("Błąd usuwania");
	}
}

function openBoard(id) {
	window.history.pushState({}, "", `/board/${id}`);
	handleRoute();
}

// ─── BOARD LOGIC ────────────────────────────────────────────────────
async function joinBoard(id) {
	try {
		const res = await fetch(`/api/boards/${id}`);
		if (!res.ok) {
			toast("Nie znaleziono tablicy");
			goHome();
			return;
		}
		const board = await res.json();
		currentBoardId = id;
		document.getElementById("board-title").textContent = board.name;
		
		shapes = board.shapes || [];
		undoHistory = [];
		redoHistory = [];
		
		// If guest, ask for nickname
		if (!session) {
			document.getElementById("guest-overlay").classList.add("active");
			return; // wait for guest form
		}

		startBoardSession();
	} catch (err) {
		console.error(err);
		goHome();
	}
}

document.getElementById("guest-form").addEventListener("submit", (e) => {
	e.preventDefault();
	currentNickname = document.getElementById("guest-nick").value.trim() || "Gość";
	document.getElementById("guest-overlay").classList.remove("active");
	startBoardSession();
});

function startBoardSession() {
	showScreen("board-screen");
	resize();
	requestAnimationFrame(loop);

	// Setup WebSocket
	if (socket) socket.disconnect();
	socket = window.io();

	socket.on("connect", () => {
		socket.emit("join-board", { boardId: currentBoardId, nickname: currentNickname });
	});

	socket.on("user-joined", (data) => {
		activeUsers = data.users;
		renderUsers();
		if (data.nickname !== currentNickname) toast(`${data.nickname} dołączył`);
	});

	socket.on("user-left", (data) => {
		activeUsers = data.users;
		renderUsers();
		toast(`${data.nickname} wyszedł`);
	});

	socket.on("shape-drawn", (shape) => {
		shapes.push(shape);
		dirty = true;
	});

	socket.on("undo-action", () => {
		if (shapes.length) {
			undoHistory.push(shapes.pop());
			dirty = true;
		}
	});

	socket.on("redo-action", () => {
		if (undoHistory.length) {
			shapes.push(undoHistory.pop());
			dirty = true;
		}
	});

	socket.on("board-cleared", () => {
		shapes = [];
		dirty = true;
	});
}

function renderUsers() {
	const list = document.getElementById("users-list");
	list.innerHTML = "";
	activeUsers.forEach(u => {
		const el = document.createElement("div");
		el.className = "user-pill";
		el.innerHTML = `<div class="dot" style="background:${u.color}"></div>${u.nickname}`;
		list.appendChild(el);
	});
}

// ─── DRAWING ENGINE ─────────────────────────────────────────────────
function resize() {
	const container = document.getElementById("canvas-container");
	if (!container) return;
	W = container.clientWidth;
	H = container.clientHeight;
	canvas.width = W;
	canvas.height = H;
	dirty = true;
}

function getPos(e) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top
	};
}

canvas.addEventListener("pointerdown", e => {
	if (e.button !== 0) return;
	canvas.setPointerCapture(e.pointerId);
	const p = getPos(e);
	drawing = true;
	startPos = p;

	if (activeTool === "pen" || activeTool === "eraser") {
		current = {
			type: activeTool,
			color: activeTool === "eraser" ? "eraser" : activeColor,
			sw: activeTool === "eraser" ? 20 : strokeWidth,
			pts: [{ x: p.x, y: p.y }]
		};
	}
	dirty = true;
});

canvas.addEventListener("pointermove", e => {
	if (!drawing || !startPos) return;
	const p = getPos(e);

	if (activeTool === "pen" || activeTool === "eraser") {
		const last = current.pts[current.pts.length - 1];
		if (Math.hypot(p.x - last.x, p.y - last.y) > 2) {
			current.pts.push({ x: p.x, y: p.y });
		}
	} else {
		current = {
			type: activeTool,
			color: activeColor,
			sw: strokeWidth,
			x1: startPos.x, y1: startPos.y,
			x2: p.x, y2: p.y
		};
		if (activeTool === "rect") {
			current = { ...current, x: Math.min(startPos.x, p.x), y: Math.min(startPos.y, p.y), w: Math.abs(p.x - startPos.x), h: Math.abs(p.y - startPos.y) };
		} else if (activeTool === "circle") {
			current = { ...current, cx: (startPos.x + p.x)/2, cy: (startPos.y + p.y)/2, rx: Math.abs(p.x - startPos.x)/2, ry: Math.abs(p.y - startPos.y)/2 };
		}
	}
	dirty = true;
});

canvas.addEventListener("pointerup", () => {
	if (!drawing) return;
	if (current) {
		shapes.push(current);
		socket.emit("draw", { boardId: currentBoardId, shape: current });
		undoHistory.push({ type: 'add', shape: current });
		redoHistory = [];
		current = null;
		saveBoardDB();
	}
	drawing = false;
	startPos = null;
	dirty = true;
});

function drawShape(s) {
	ctx.save();
	
	if (s.color === "eraser" || s.type === "eraser") {
		ctx.globalCompositeOperation = "destination-out";
		ctx.strokeStyle = "rgba(0,0,0,1)";
		ctx.lineWidth = s.sw || 20;
	} else {
		ctx.strokeStyle = s.color || "#fff";
		ctx.fillStyle = s.color || "#fff";
		ctx.lineWidth = s.sw || 2;
	}
	
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	if ((s.type === "pen" || s.type === "eraser") && s.pts) {
		ctx.beginPath();
		ctx.moveTo(s.pts[0].x, s.pts[0].y);
		for (let i = 1; i < s.pts.length - 1; i++) {
			const mx = (s.pts[i].x + s.pts[i+1].x) / 2;
			const my = (s.pts[i].y + s.pts[i+1].y) / 2;
			ctx.quadraticCurveTo(s.pts[i].x, s.pts[i].y, mx, my);
		}
		if (s.pts.length > 1) {
			ctx.lineTo(s.pts[s.pts.length-1].x, s.pts[s.pts.length-1].y);
		}
		ctx.stroke();
	} else if (s.type === "line") {
		ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
	} else if (s.type === "rect") {
		ctx.strokeRect(s.x, s.y, s.w, s.h);
	} else if (s.type === "circle") {
		ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI*2); ctx.stroke();
	}

	ctx.restore();
}

function redraw() {
	ctx.clearRect(0, 0, W, H);
	shapes.forEach(drawShape);
	if (current) drawShape(current);
	dirty = false;
}

function loop() {
	if (dirty) redraw();
	if (document.getElementById("board-screen").classList.contains("active")) {
		requestAnimationFrame(loop);
	}
}

// ─── ACTIONS & TOOLS ────────────────────────────────────────────────
document.querySelectorAll(".tool-btn").forEach(btn => {
	btn.addEventListener("click", () => {
		document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
		btn.classList.add("active");
		activeTool = btn.dataset.tool;
	});
});

document.getElementById("color-picker").addEventListener("input", (e) => {
	activeColor = e.target.value;
	// Auto switch to pen if using eraser
	if (activeTool === "eraser") {
		document.querySelector('[data-tool="pen"]').click();
	}
});

function undo() {
	if (!shapes.length) return;
	undoHistory.push(shapes.pop());
	socket.emit("undo", { boardId: currentBoardId });
	dirty = true;
	saveBoardDB();
}

function redo() {
	if (!undoHistory.length) return;
	shapes.push(undoHistory.pop());
	socket.emit("redo", { boardId: currentBoardId });
	dirty = true;
	saveBoardDB();
}

function clearBoard() {
	if (!confirm("Wyczyścić tablicę?")) return;
	shapes = [];
	undoHistory = [];
	socket.emit("clear-board", { boardId: currentBoardId });
	dirty = true;
	saveBoardDB();
}

let saveTimeout;
function saveBoardDB() {
	clearTimeout(saveTimeout);
	saveTimeout = setTimeout(() => {
		if (currentBoardId) {
			fetch(`/api/boards/${currentBoardId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ shapes })
			});
		}
	}, 1000);
}

// ─── UI UTILS ───────────────────────────────────────────────────────
function toast(msg) {
	const el = document.getElementById("toast");
	el.textContent = msg;
	el.classList.add("show");
	setTimeout(() => el.classList.remove("show"), 3000);
}

function openShareModal() {
	const input = document.getElementById("share-link");
	input.value = window.location.href;
	document.getElementById("share-modal").classList.add("active");
}

function closeShareModal() {
	document.getElementById("share-modal").classList.remove("active");
}

function copyShareLink() {
	const input = document.getElementById("share-link");
	input.select();
	document.execCommand("copy");
	toast("Skopiowano do schowka!");
	closeShareModal();
}

// Start app
init();
