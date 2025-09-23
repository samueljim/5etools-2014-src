/**
 * Cloudflare Worker with WebSockets for real-time character synchronization
 * Uses Durable Objects for proper room management and D1 database for persistent storage
 */
import { RoomManager } from "./room-manager.js";
import { handleCharacterAPI } from "./character-api.js";
import { handleSourceAPI } from "./password-utils.js";
import { handleAuthAPI } from "./auth-api.js";
import { handleMigration, handleMigrationStatus } from "./migrate-from-vercel.js";

export { RoomManager };

export default {
	async fetch (request, env, ctx) {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const upgradeHeader = request.headers.get("Upgrade");

		// Handle API endpoints
		if (pathname.startsWith("/api/characters")) {
			return handleCharacterAPI(request, env);
		}

		if (pathname.startsWith("/api/sources")) {
			return handleSourceAPI(request, env);
		}

		if (pathname.startsWith("/api/auth")) {
			return handleAuthAPI(request, env);
		}

		// Handle migration endpoints
		if (pathname === "/migrate") {
			return handleMigration(request, env);
		}

		if (pathname === "/migrate/status") {
			return handleMigrationStatus(request, env);
		}

		// Handle WebSocket connections for real-time sync
		if (upgradeHeader === "websocket") {
			// Get room name from URL (default to 'character-sync')
			const roomName = url.searchParams.get("room") || "character-sync";

			// Get Durable Object instance for this room
			const roomId = env.ROOM_MANAGER.idFromName(roomName);
			const roomObject = env.ROOM_MANAGER.get(roomId);

			// Forward the request to the Durable Object
			return roomObject.fetch(request);
		}

		// Default response for non-WebSocket, non-API requests
		return new Response(
			JSON.stringify({
				message: "5etools Character Sync & API Worker",
				version: "2.0.0",
				endpoints: {
					websocket: "ws://" + request.headers.get("host") + "/?room=character-sync",
				api: {
					auth: ["/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/auth/me"],
					characters: ["/api/characters/save", "/api/characters/get", "/api/characters/list", "/api/characters/delete"],
					sources: ["/api/sources/create", "/api/sources/list", "/api/sources/validate"],
					migration: ["/migrate", "/migrate/status"]
				}
				},
				status: "ready"
			}, null, 2),
			{
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			}
		);
	},
};
