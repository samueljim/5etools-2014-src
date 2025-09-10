import {InitiativeTrackerWebSocket} from './dmscreen-initiativetracker-ws.js';
import {InitiativeTrackerPlayerView} from './dmscreen-initiativetracker-player-view.js';

export class InitiativeTrackerPlayerViewWS {
    constructor ({board}) {
        this._board = board;
        this._webSocket = null;
        this._playerView = null;
    }

    static $getPanelElement (board) {
        return (new this({board})).render();
    }

    render () {
        const $wrpTracker = $(`<div class="dm-init dm__panel-bg dm__data-anchor"></div>`);
        
        const $wrpMessage = $(`<div class="ve-flex-col w-100 h-100 ve-flex-vh-center"></div>`);
        const $btnJoinChannel = $(`<button class="btn btn-primary btn-sm mb-2">Join WebSocket Channel</button>`);
        const $message = $(`<div class="text-muted small">Click to join an available channel</div>`);
        
        $wrpMessage.append($btnJoinChannel).append($message);
        $wrpTracker.append($wrpMessage);

        $btnJoinChannel.click(async () => {
            this._webSocket = new InitiativeTrackerWebSocket({board: this._board});
            this._playerView = new InitiativeTrackerPlayerView();

            // Initialize networking and show channel list
            await this._webSocket.initializeAsPlayer();
            const $wrpContent = await this._playerView.pOpenPlayerView({
                networking: this._webSocket,
                characterData: await CharacterManager.getCurrentCharacter()
            });

            // Replace initial content with player view
            $wrpTracker.empty().append($wrpContent);
        });

        // Clean up on panel close
        $wrpTracker.data("cleanup", () => {
            if (this._webSocket) {
                this._webSocket.cleanup();
                this._webSocket = null;
            }
        });

        return $wrpTracker;
    }
}
