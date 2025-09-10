/**
 * WebSocket-based initiative tracker networking module.
 */
export class InitiativeTrackerWebSocket {
	constructor ({board}) {
		this._board = board;
		this._ws = null;
		this._channels = new Map(); // channelId -> channel info
		this._currentChannelId = null;
	}

	async initializeAsDm () {
		await this._initWebSocket();
		this._isDm = true;
	}

	async initializeAsPlayer () {
		await this._initWebSocket();
		this._isDm = false;
	}

	async _initWebSocket () {
		console.log("InitiativeTracker WebSocket: Connecting to server...");
		
		try {
			this._ws = new WebSocket("wss://5etools-character-sync.thesamueljim.workers.dev");
			this._ws.onmessage = this._handleWebSocketMessage.bind(this);
			this._ws.onclose = this._handleWebSocketClose.bind(this);
			this._ws.onerror = this._handleWebSocketError.bind(this);

			// Wait for connection
			await new Promise((resolve, reject) => {
				this._ws.onopen = () => {
					console.log("InitiativeTracker WebSocket: Connected successfully");
					resolve();
				};
				setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
			});

			// Join initiative tracker room
			console.log("InitiativeTracker WebSocket: Joining initiative-tracker room");
			this._send({type: "JOIN_ROOM", room: "initiative-tracker"});
		} catch (error) {
			console.warn("InitiativeTracker WebSocket: Failed to connect to server, enabling demo mode", error);
			this._enableDemoMode();
		}
	}

	_enableDemoMode() {
		console.log("InitiativeTracker WebSocket: Demo mode enabled - simulating channels");
		this._demoMode = true;
		
		// Add some demo channels
		setTimeout(() => {
			const demoChannels = [
				{
					id: 'demo-1',
					name: 'Demo Combat Session',
					dmName: 'Demo DM',
					playerCount: 2,
					players: [{name: 'Alice'}, {name: 'Bob'}],
					description: 'Demo channel for testing'
				},
				{
					id: 'demo-2', 
					name: 'Another Demo Game',
					dmName: 'Another DM',
					playerCount: 1,
					players: [{name: 'Charlie'}]
				}
			];
			
			this._channels.clear();
			demoChannels.forEach(channel => {
				this._channels.set(channel.id, channel);
			});
			
			this._onChannelsUpdated?.(Array.from(this._channels.values()));
		}, 100);
	}

	async createChannel ({channelName, dmName}) {
		if (!this._isDm) throw new Error("Only DMs can create channels");

		const channelId = crypto.randomUUID();
		console.log("InitiativeTracker WebSocket: Creating channel", {channelId, channelName, dmName});
		
		try {
			this._send({
				type: "CREATE_CHANNEL",
				channelId,
				channelName,
				dmName,
			});

			this._currentChannelId = channelId;
			return channelId;
		} catch (error) {
			console.error("InitiativeTracker WebSocket: Failed to create channel", error);
			throw error;
		}
	}

	async joinChannel ({channelId, playerName, characterData}) {
		if (this._isDm) throw new Error("DMs cannot join channels");

		this._send({
			type: "JOIN_CHANNEL",
			channelId,
			playerName,
			characterData,
		});

		this._currentChannelId = channelId;
	}

	async leaveChannel () {
		if (!this._currentChannelId) return;

		this._send({
			type: "LEAVE_CHANNEL",
			channelId: this._currentChannelId,
		});

		this._currentChannelId = null;
	}

	async getChannels () {
		return new Promise((resolve, reject) => {
			// Set up a one-time listener for the channel list response
			const originalHandler = this._onChannelsUpdated;
			
			const timeout = setTimeout(() => {
				this._onChannelsUpdated = originalHandler;
				reject(new Error("Timeout waiting for channel list"));
			}, 5000);
			
			this._onChannelsUpdated = (channels) => {
				clearTimeout(timeout);
				this._onChannelsUpdated = originalHandler;
				if (originalHandler) originalHandler(channels);
				resolve(channels);
			};
			
			// Request the channel list from server
			this._send({type: "GET_CHANNEL_LIST"});
		});
	}

	// Methods expected by the networking layer
	sendStateToClients ({fnGetToSend}) {
		if (!this._isDm || !this._currentChannelId) return;
		
		const stateData = fnGetToSend();
		this._send({
			type: "INITIATIVE_STATE_UPDATE",
			channelId: this._currentChannelId,
			state: stateData,
		});
	}

	sendShowImageMessageToClients ({imageHref}) {
		if (!this._isDm || !this._currentChannelId) return;
		
		this._send({
			type: "SHOW_IMAGE",
			channelId: this._currentChannelId,
			imageHref,
		});
	}

	setMessageHandlers ({onStateMessage, onShowImageMessage}) {
		this._onStateMessage = onStateMessage;
		this._onShowImageMessage = onShowImageMessage;
	}

	cleanup () {
		if (this._ws) {
			this._ws.close();
			this._ws = null;
		}
		this._currentChannelId = null;
		this._channels.clear();
	}

	_handleWebSocketMessage (event) {
		try {
			const message = JSON.parse(event.data);
			console.log("InitiativeTracker WebSocket: Received message", message.type, message);

			switch (message.type) {
			case "CHANNEL_LIST":
				this._channels.clear();
				message.channels.forEach(channel => {
					this._channels.set(channel.id, channel);
				});
				this._onChannelsUpdated?.(Array.from(this._channels.values()));
				break;

			case "CHANNEL_CREATED":
				this._channels.set(message.channel.id, message.channel);
				this._onChannelsUpdated?.(Array.from(this._channels.values()));
				break;

			case "CHANNEL_DELETED":
				this._channels.delete(message.channelId);
				this._onChannelsUpdated?.(Array.from(this._channels.values()));
				break;

			case "PLAYER_JOINED":
				if (message.channelId === this._currentChannelId) {
					this._onPlayerJoined?.(message.player);
					// Update channel info with new player count
					const channel = this._channels.get(message.channelId);
					if (channel) {
						channel.playerCount = (channel.playerCount || 0) + 1;
						channel.players = channel.players || [];
						channel.players.push(message.player);
					}
				}
				break;

			case "PLAYER_LEFT":
				if (message.channelId === this._currentChannelId) {
					this._onPlayerLeft?.(message.player);
					// Update channel info with reduced player count
					const channel = this._channels.get(message.channelId);
					if (channel) {
						channel.playerCount = Math.max(0, (channel.playerCount || 1) - 1);
						channel.players = (channel.players || []).filter(p => p.id !== message.player.id);
					}
				}
				break;

			case "INITIATIVE_STATE_UPDATE":
				if (message.channelId === this._currentChannelId && !this._isDm) {
					this._onStateMessage?.(message.state);
				}
				break;

			case "SHOW_IMAGE":
				if (message.channelId === this._currentChannelId && !this._isDm) {
					this._onShowImageMessage?.({
						type: "showImage",
						payload: { imageHref: message.imageHref }
					});
				}
				break;

			case "DICE_ROLL":
				if (message.channelId === this._currentChannelId) {
					this._onDiceRoll?.(message.roll);
				}
				break;

			case "CHARACTER_UPDATE":
				if (message.channelId === this._currentChannelId) {
					this._onCharacterUpdate?.(message.character);
				}
				break;
		}
		} catch (error) {
			console.error("InitiativeTracker WebSocket: Error handling message", error);
		}
	}

	_handleWebSocketClose () {
		console.log("WebSocket closed, attempting reconnect...");
		setTimeout(() => this._initWebSocket(), 5000);
	}

	_handleWebSocketError (error) {
		console.error("WebSocket error:", error);
	}

	_send (data) {
		if (this._ws?.readyState !== WebSocket.OPEN) {
			console.error("InitiativeTracker WebSocket: Cannot send message, WebSocket not connected. State:", this._ws?.readyState);
			throw new Error("WebSocket not connected");
		}
		console.log("InitiativeTracker WebSocket: Sending message", data.type, data);
		this._ws.send(JSON.stringify(data));
	}

	// Event handlers that can be set by users of this class
	setOnChannelsUpdated (handler) { this._onChannelsUpdated = handler; }
	setOnDiceRoll (handler) { this._onDiceRoll = handler; }
	setOnCharacterUpdate (handler) { this._onCharacterUpdate = handler; }
	setOnPlayerJoined (handler) { this._onPlayerJoined = handler; }
	setOnPlayerLeft (handler) { this._onPlayerLeft = handler; }
}
