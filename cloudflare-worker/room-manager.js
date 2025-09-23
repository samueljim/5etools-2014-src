/**
 * Durable Object class for managing WebSocket rooms
 * This ensures persistent state across multiple worker instances
 */
export class RoomManager {
	constructor (controller, env) {
		this.controller = controller;
		this.env = env;
		this.sessions = new Map();
	}

	async fetch (request) {
		// Handle internal broadcast requests
		if (request.headers.get('X-Internal-Broadcast') === 'true') {
			return this.handleInternalBroadcast(request);
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		const url = new URL(request.url);
		const roomName = url.searchParams.get("room") || "character-sync";
		const userId = url.searchParams.get("userId") || "anonymous";
		const sessionId = `${userId}:${Date.now()}`;

		console.log(`User ${userId} joining room ${roomName} (session: ${sessionId})`);

		// Accept WebSocket connection
		server.accept();

		// Store session
		this.sessions.set(sessionId, {
			socket: server,
			userId: userId,
			roomName: roomName,
			connected: true,
		});

		// Handle client messages (optional - for heartbeat/ping)
		server.addEventListener("message", async event => {
			try {
				const message = JSON.parse(event.data);
				console.log(`[ROOM] Received client message: ${message.type} from ${userId}`);
				
				// Only handle heartbeat messages - no client-to-client forwarding
				if (message.type === "HEARTBEAT") {
					// Respond with heartbeat acknowledgment
					server.send(JSON.stringify({
						type: "HEARTBEAT_ACK",
						timestamp: Date.now()
					}));
				} else {
					console.log(`[ROOM] Ignoring client message type: ${message.type} (server-to-client only)`);
				}
			} catch (error) {
				console.error(`[ROOM] Error processing client message:`, error);
			}
		});

		// Handle disconnection
		server.addEventListener("close", event => {
			console.log(`[ROOM] User ${userId} disconnected from room ${roomName}`);
			this.sessions.delete(sessionId);
			// No need to broadcast disconnections in server-to-client model
		});

		server.addEventListener("error", event => {
			console.error(`WebSocket error for user ${userId}:`, event);
			this.sessions.delete(sessionId);
		});

		// Send welcome message
		server.send(JSON.stringify({
			type: "CONNECTED",
			message: `Connected to character sync server`,
			userId: userId,
			timestamp: Date.now(),
			room: roomName
		}));

		console.log(`[ROOM] User ${userId} connected to room ${roomName}. Total sessions: ${this.sessions.size}`);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	/**
   * Broadcast message to all sessions in a room except the sender
   */
	broadcastToRoom (roomName, message, excludeSessionId = null) {
		const messageStr = JSON.stringify(message);
		let broadcastCount = 0;

		for (const [sessionId, session] of this.sessions.entries()) {
			// Skip sender's session
			if (sessionId === excludeSessionId) {
				continue;
			}

			// Only broadcast to sessions in the same room
			if (session.roomName !== roomName) {
				continue;
			}

			try {
				if (session.socket && session.socket.readyState === WebSocket.READY_STATE_OPEN) {
					session.socket.send(messageStr);
					broadcastCount++;
				} else {
					// Clean up dead sessions
					console.log(`Removing dead session: ${sessionId}`);
					this.sessions.delete(sessionId);
				}
			} catch (error) {
				console.error(`Error broadcasting to session ${sessionId}:`, error);
				this.sessions.delete(sessionId);
			}
		}

	console.log(`Broadcasted ${message.type} to ${broadcastCount} sessions in room ${roomName}`);
	}

	/**
	 * Handle internal broadcast requests from API endpoints
	 */
	async handleInternalBroadcast(request) {
		try {
			console.log('[ROOM] Received internal broadcast request');
			console.log('[ROOM] Request method:', request.method);
			console.log('[ROOM] Request headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
			
			const message = await request.json();
			console.log('[ROOM] Parsed message:', JSON.stringify(message));
			
			const roomName = message.room || "character-sync";
			
			console.log(`[ROOM] Internal broadcast request: ${message.type} for character ${message.characterId} in room ${roomName}`);
			console.log(`[ROOM] Current sessions: ${this.sessions.size}`);
			
			// Broadcast to all sessions in the room
			this.broadcastToRoom(roomName, message);
			
			console.log(`[ROOM] Broadcast completed successfully`);
			
			return new Response(JSON.stringify({ 
				success: true, 
				message: `Broadcasted ${message.type} to room ${roomName}`,
				sessionCount: this.sessions.size
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
			
		} catch (error) {
			console.error('[ROOM] Error handling internal broadcast:', error);
			console.error('[ROOM] Error stack:', error.stack);
			return new Response(JSON.stringify({ 
				error: 'Broadcast failed',
				details: error.message,
				stack: error.stack
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}
}
