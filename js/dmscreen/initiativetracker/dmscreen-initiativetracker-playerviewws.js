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
        
        const $wrpMessage = $(`<div class="ve-flex-col w-100 h-100 ve-flex-vh-center p-3"></div>`);
        
        // Character selection UI
        const $wrpCharacterSelect = $(`<div class="mb-3 w-100" style="max-width: 300px;"></div>`);
        const $lblCharacter = $(`<label class="mb-1">Select Character:</label>`);
        const $selCharacter = $(`<select class="form-control input-xs mb-2">
            <option value="">Choose a character...</option>
        </select>`);
        const $inputCustomName = $(`<input type="text" class="form-control input-xs mb-2" placeholder="Or enter custom name" style="display: none;">`);
        const $btnUseCustomName = $(`<button class="btn btn-xs btn-default mb-2">Use Custom Name</button>`);
        const $btnLoadCharacters = $(`<button class="btn btn-xs btn-default mb-2">Refresh Characters</button>`);
        
        $wrpCharacterSelect.append($lblCharacter).append($selCharacter).append($inputCustomName).append($btnUseCustomName).append($btnLoadCharacters);
        
        const $btnJoinChannel = $(`<button class="btn btn-primary btn-sm mb-2" disabled>Join WebSocket Channel</button>`);
        const $message = $(`<div class="text-muted small text-center">Select a character or enter a name to join</div>`);
        
        $wrpMessage.append($wrpCharacterSelect).append($btnJoinChannel).append($message);
        $wrpTracker.append($wrpMessage);

        // Load characters on init
        const loadCharacters = async () => {
            try {
                const characters = await CharacterManager.loadCharacters();
                $selCharacter.empty().append(`<option value="">Choose a character...</option>`);
                characters.forEach(char => {
                    $selCharacter.append(`<option value="${char.name}" data-source="${char.source || ''}">${char.name}</option>`);
                });
            } catch (error) {
                console.warn('Failed to load characters:', error);
            }
        };

        // Toggle between character selection and custom name input
        let useCustomName = false;
        $btnUseCustomName.click(() => {
            useCustomName = !useCustomName;
            if (useCustomName) {
                $selCharacter.hide();
                $inputCustomName.show().focus();
                $btnUseCustomName.text("Use Character List");
                $message.text("Enter your character name");
            } else {
                $selCharacter.show();
                $inputCustomName.hide();
                $btnUseCustomName.text("Use Custom Name");
                $message.text("Select a character or enter a name to join");
            }
            updateJoinButton();
        });

        // Enable/disable join button based on selection
        const updateJoinButton = () => {
            const hasSelection = useCustomName ? 
                $inputCustomName.val().trim() : 
                $selCharacter.val();
            $btnJoinChannel.prop('disabled', !hasSelection);
        };

        $selCharacter.on('change', updateJoinButton);
        $inputCustomName.on('input', updateJoinButton);
        $btnLoadCharacters.click(loadCharacters);

        $btnJoinChannel.click(async () => {
            let characterData;
            
            if (useCustomName) {
                const name = $inputCustomName.val().trim();
                characterData = { name };
            } else {
                const selectedName = $selCharacter.val();
                const selectedOption = $selCharacter.find('option:selected');
                const source = selectedOption.data('source') || '';
                characterData = { name: selectedName, source };
            }

            this._webSocket = new InitiativeTrackerWebSocket({board: this._board});
            this._playerView = new InitiativeTrackerPlayerView();

            // Initialize networking and show channel list
            await this._webSocket.initializeAsPlayer();
            const $wrpContent = await this._playerView.pOpenPlayerView({
                networking: this._webSocket,
                characterData: characterData
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

        // Initial character load
        loadCharacters();

        return $wrpTracker;
    }
}
