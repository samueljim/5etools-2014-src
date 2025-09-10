/**
 * WebSocket-based initiative tracker networking module.
 */
class InitiativeTrackerWebSocket {
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
		this._ws = new WebSocket("wss://5etools-character-sync.thesamueljim.workers.dev");
		this._ws.onmessage = this._handleWebSocketMessage.bind(this);
		this._ws.onclose = this._handleWebSocketClose.bind(this);
		this._ws.onerror = this._handleWebSocketError.bind(this);

		// Wait for connection
		await new Promise((resolve, reject) => {
			this._ws.onopen = resolve;
			setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
		});

		// Join initiative tracker room
		this._send({type: "JOIN_ROOM", room: "initiative-tracker"});
	}

	async createChannel ({channelName, dmName}) {
		if (!this._isDm) throw new Error("Only DMs can create channels");

		const channelId = crypto.randomUUID();
		this._send({
			type: "CREATE_CHANNEL",
			channelId,
			channelName,
			dmName,
		});

		return channelId;
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
		this._send({type: "GET_CHANNEL_LIST"});
		return Array.from(this._channels.values());
	}

	_handleWebSocketMessage (event) {
		const message = JSON.parse(event.data);

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
			throw new Error("WebSocket not connected");
		}
		this._ws.send(JSON.stringify(data));
	}

	// Event handlers that can be set by users of this class
	setOnChannelsUpdated (handler) { this._onChannelsUpdated = handler; }
	setOnDiceRoll (handler) { this._onDiceRoll = handler; }
	setOnCharacterUpdate (handler) { this._onCharacterUpdate = handler; }
}

export {InitiativeTrackerWebSocket};
