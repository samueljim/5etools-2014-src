/**
 * Player view component for joining and viewing initiative tracker channels
 */
class InitiativeTrackerPlayerView {
	constructor () {
		this._networking = null;
		this._channels = [];
		this._$wrpChannels = null;
		this._characterData = null;
	}

	pOpenPlayerView ({networking, characterData}) {
		this._networking = networking;
		this._characterData = characterData;

		const $wrpModal = document.createElement("div");
		$wrpModal.className = "ve-flex-col w-100 h-100";

		const $wrpHeader = document.createElement("div");
		$wrpHeader.className = "split-v-center w-100 mb-2";

		const $wrpLeft = document.createElement("div");
		$wrpLeft.className = "mr-2";

		const $label = document.createElement("label");
		$label.className = "bold";
		$label.textContent = "Available Channels";
		$wrpLeft.appendChild($label);

		const $btnRefresh = document.createElement("button");
		$btnRefresh.className = "btn btn-default";
		$btnRefresh.textContent = "Refresh";
		$btnRefresh.onclick = () => this._handleClickRefresh();
		$wrpHeader.appendChild($wrpLeft);
		$wrpHeader.appendChild($btnRefresh);

		this._$wrpChannels = document.createElement("div");
		this._$wrpChannels.className = "ve-flex-col overflow-y-auto min-h-0 ve-window-content-root";

		$wrpModal.appendChild($wrpHeader);
		$wrpModal.appendChild(this._$wrpChannels);

		// Set up event handlers
		this._networking.setOnChannelsUpdated(channels => this._renderChannels(channels));

		// Initial channel fetch
		this._handleClickRefresh();

		return $wrpModal;
	}

	_handleClickRefresh () {
		this._networking.getChannels();
	}

	_renderChannels (channels) {
		this._$wrpChannels.innerHTML = "";
		this._channels = channels;

		if (!channels.length) {
			const $noChannels = document.createElement("div");
			$noChannels.className = "ve-flex-v-center w-100 h-100";
			$noChannels.textContent = "No channels available. Ask your DM to create one.";
			this._$wrpChannels.appendChild($noChannels);
			return;
		}

		channels.forEach(channel => {
			const $channel = document.createElement("div");
			$channel.className = "ve-flex-col p-2 mb-2 clickable list-row-hoverable";
			$channel.onclick = () => this._handleClickJoinChannel(channel);

			const $wrpTop = document.createElement("div");
			$wrpTop.className = "split-v-center";

			const $channelName = document.createElement("div");
			$channelName.className = "bold";
			$channelName.textContent = channel.channelName;

			const $dmName = document.createElement("div");
			$dmName.className = "italic";
			$dmName.textContent = `DM: ${channel.dmName}`;

			$wrpTop.appendChild($channelName);
			$wrpTop.appendChild($dmName);

			const $playerCount = document.createElement("div");
			$playerCount.className = "small";
			$playerCount.textContent = `${channel.playerCount || 0} player(s)`;

			$channel.appendChild($wrpTop);
			$channel.appendChild($playerCount);

			this._$wrpChannels.appendChild($channel);
		});
	}

	async _handleClickJoinChannel (channel) {
		await this._networking.joinChannel({
			channelId: channel.id,
			playerName: this._characterData.name,
			characterData: this._characterData,
		});

		// Close the modal after joining
		window.genericUtil.closeModal();
	}
}

export {InitiativeTrackerPlayerView};
