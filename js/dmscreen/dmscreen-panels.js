import {
	PANEL_TYP_ADVENTURE_DYNAMIC_MAP,
	PANEL_TYP_COUNTER,
	PANEL_TYP_INITIATIVE_TRACKER, PANEL_TYP_INITIATIVE_TRACKER_CREATURE_VIEWER,
	PANEL_TYP_INITIATIVE_TRACKER_PLAYER_V0,
	PANEL_TYP_INITIATIVE_TRACKER_PLAYER_V1, PANEL_TYP_MONEY_CONVERTER, PANEL_TYP_TEXTBOX, PANEL_TYP_TIME_TRACKER, PANEL_TYP_UNIT_CONVERTER,
	PANEL_TYP_CHARACTERS,

} from "./dmscreen-consts.js";
import {InitiativeTracker} from "./initiativetracker/dmscreen-initiativetracker.js";
import {InitiativeTrackerPlayerV0, InitiativeTrackerPlayerV1} from "./dmscreen-playerinitiativetracker.js";
import {InitiativeTrackerCreatureViewer} from "./dmscreen-initiativetrackercreatureviewer.js";
import {Counter} from "./dmscreen-counter.js";
import {NoteBox} from "./dmscreen-notebox.js";
import {UnitConverter} from "./dmscreen-unitconverter.js";
import {MoneyConverter} from "./dmscreen-moneyconverter.js";
import {TimeTracker} from "./dmscreen-timetracker.js";
import {DmMapper} from "./dmscreen-mapper.js";
import {DmScreenPanelAppBase} from "./dmscreen-panelapp-base.js";
// CharacterManager is available globally via character-manager.js script tag

export class PanelContentManagerFactory {
	static _PANEL_TYPES = {};

	static registerPanelType ({panelType, Cls}) {
		this._PANEL_TYPES[panelType] = Cls;
	}

	/* -------------------------------------------- */

	static async pFromSavedState ({board, saved, ixTab, panel}) {
		if (!this._PANEL_TYPES[saved.t]) return undefined;

		const ContentManager = new this._PANEL_TYPES[saved.t]({board, panel});
		await ContentManager.pLoadState({ixTab, saved});

		return true;
	}

	/* -------------------------------------------- */

	static getSaveableContent (
		{
			type,
			toSaveTitle,
			panelApp,
		},
	) {
		if (!this._PANEL_TYPES[type]) return undefined;

		return this._PANEL_TYPES[type]
			.getSaveableContent({
				type,
				toSaveTitle,
				panelApp,
			});
	}
}

/* -------------------------------------------- */

class _PanelContentManager {
	static _PANEL_TYPE = null;
	static _TITLE = null;
	static _IS_STATELESS = false;

	static _register () {
		PanelContentManagerFactory.registerPanelType({panelType: this._PANEL_TYPE, Cls: this});
		return null;
	}

	static getSaveableContent (
		{
			type,
			toSaveTitle,
			panelApp,
		},
	) {
		return {
			t: type,
			r: toSaveTitle,
			s: this._IS_STATELESS
				? {}
				: panelApp.getState(),
		};
	}

	/* -------------------------------------------- */

	constructor (
		{
			board,
			panel,
		},
	) {
		this._board = board;
		this._panel = panel;
	}

	/* -------------------------------------------- */

	/**
	 * @abstract
	 * @return {*}
	 */
	_getPanelApp ({state}) {
		throw new Error("Unimplemented!");
	}

	async pDoPopulate ({state = {}, title = null} = {}) {
		const panelApp = this._getPanelApp({state});

		this._panel.setEleContentTab({
			panelType: this.constructor._PANEL_TYPE,
			contentMeta: state,
			panelApp,
			eleContent: ee`<div class="panel-content-wrapper-inner"></div>`.appends(panelApp.getPanelElement()),
			title: title || this.constructor._TITLE,
			tabCanRename: true,
		});

		this._board.fireBoardEvent({type: "panelPopulate", payload: {type: this.constructor._PANEL_TYPE}});
	}

	_doHandleTabRenamed ({ixTab, saved}) {
		if (saved.r != null) this._panel.tabDatas[ixTab].tabRenamed = true;
	}

	async pLoadState ({ixTab, saved}) {
		await this.pDoPopulate({state: saved.s, title: saved.r});
		this._doHandleTabRenamed({ixTab, saved});
	}
}

export class PanelContentManager_InitiativeTracker extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_INITIATIVE_TRACKER;
	static _TITLE = "Initiative Tracker";

	static _ = this._register();

	_getPanelApp ({state}) {
		return InitiativeTracker.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_InitiativeTrackerCreatureViewer extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_INITIATIVE_TRACKER_CREATURE_VIEWER;
	static _TITLE = "Creature Viewer";
	static _IS_STATELESS = true;

	static _ = this._register();

	_getPanelApp ({state}) {
		return InitiativeTrackerCreatureViewer.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_InitiativeTrackerPlayerViewV1 extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_INITIATIVE_TRACKER_PLAYER_V1;
	static _TITLE = "Initiative Tracker";
	static _IS_STATELESS = true;

	static _ = this._register();

	_getPanelApp ({state}) {
		return InitiativeTrackerPlayerV1.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_InitiativeTrackerPlayerViewV0 extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_INITIATIVE_TRACKER_PLAYER_V0;
	static _TITLE = "Initiative Tracker";
	static _IS_STATELESS = true;

	static _ = this._register();

	_getPanelApp ({state}) {
		return InitiativeTrackerPlayerV0.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_Counter extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_COUNTER;
	static _TITLE = "Counter";

	static _ = this._register();

	_getPanelApp ({state}) {
		return Counter.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_NoteBox extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_TEXTBOX;
	static _TITLE = "Notes";

	static _ = this._register();

	_getPanelApp ({state}) {
		return NoteBox.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_UnitConverter extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_UNIT_CONVERTER;
	static _TITLE = "Unit Converter";

	static _ = this._register();

	_getPanelApp ({state}) {
		return UnitConverter.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_MoneyConverter extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_MONEY_CONVERTER;
	static _TITLE = "Coin Converter";

	static _ = this._register();

	_getPanelApp ({state}) {
		return MoneyConverter.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_TimeTracker extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_TIME_TRACKER;
	static _TITLE = "Time Tracker";

	static _ = this._register();

	_getPanelApp ({state}) {
		return TimeTracker.getPanelApp({board: this._board, savedState: state});
	}
}

export class PanelContentManager_DynamicMap extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_ADVENTURE_DYNAMIC_MAP;
	static _TITLE = "Map Viewer";

	static _ = this._register();

	_getPanelApp ({state}) {
		return DmMapper.getPanelApp({board: this._board, savedState: state});
	}
}

class CharactersPanelApp extends DmScreenPanelAppBase {
	constructor (...args) {
		super(...args);
		this._selCharacter = null;
		this._eleContent = null;
		this._currentCharacterId = null;
		this._characterUpdateListener = null;
	}

	_getPanelElement (board, state) {
		const wrpPanel = ee`<div class="ve-flex-col ve-h-100 min-h-0"></div>`;

		const selCharacter = ee`<select class="ve-form-control ve-input-xs" title="Select Character">
			<option value="">Select a character...</option>
		</select>`;
		const btnRefresh = ee`<button type="button" class="ve-btn ve-btn-xs ve-btn-default ve-ml-2" title="Refresh Characters">
			<span class="glyphicon glyphicon-refresh"></span>
		</button>`;
		const eleContent = ee`<div class="ve-flex-col min-h-0 ve-h-100 ve-overflow-y-auto"></div>`;

		ee`<div class="ve-p-2 ve-flex-v-center">
			<label class="ve-mr-2">Character:</label>
			${selCharacter}
			${btnRefresh}
		</div>`.appendTo(wrpPanel);
		eleContent.appendTo(wrpPanel);

		this._selCharacter = selCharacter;
		this._eleContent = eleContent;

		const loadCharacters = async () => {
			try {
				const summaries = await CharacterManager.loadCharacterSummaries();
				selCharacter.empty().appends(`<option value="">Select a character...</option>`);
				summaries.forEach(summary => {
					selCharacter.appends(
						ee`<option></option>`
							.val(summary.id)
							.attr("data-name", summary.name)
							.txt(summary.name),
					);
				});
			} catch (error) {
				console.warn("Failed to load character summaries for DM screen:", error);
			}
		};

		this._characterUpdateListener = (characters) => {
			if (!this._currentCharacterId) return;

			const updatedCharacter = characters.find(c => {
				const id = CharacterManager._generateCompositeId(c.name, c.source);
				return id === this._currentCharacterId;
			});
			if (!updatedCharacter) return;

			if (!globalThis._CHARACTER_EDIT_DATA) globalThis._CHARACTER_EDIT_DATA = {};
			globalThis._CHARACTER_EDIT_DATA[this._currentCharacterId] = updatedCharacter;

			this._renderCharacter(updatedCharacter);
		};

		CharacterManager.addListener(this._characterUpdateListener);

		selCharacter.onn("change", async () => {
			const characterId = selCharacter.val();
			if (!characterId) {
				eleContent.empty();
				this._currentCharacterId = null;
				board.doSaveStateDebounced();
				return;
			}

			eleContent.html(`<div class="ve-p-2 ve-text-center">Loading character...</div>`);
			this._currentCharacterId = characterId;
			board.doSaveStateDebounced();

			try {
				const character = await CharacterManager.ensureFullCharacter(characterId);
				if (character) {
					if (!globalThis._CHARACTER_EDIT_DATA) globalThis._CHARACTER_EDIT_DATA = {};
					globalThis._CHARACTER_EDIT_DATA[characterId] = character;
					this._renderCharacter(character);
				} else {
					eleContent.html(`<div class="ve-p-2 text-danger">
						Character not found or failed to load
						${!navigator.onLine ? " (you are offline)" : ""}
					</div>`);
				}
			} catch (error) {
				console.warn("Failed to load character:", error);
				eleContent.html(`<div class="ve-p-2 text-danger">
					Error: ${(error.message || "Failed to load character").qq()}
				</div>`);
				this._currentCharacterId = null;
			}
		});

		btnRefresh.onn("click", () => loadCharacters());

		loadCharacters().then(() => {
			if (state?.selectedCharacter) {
				selCharacter.val(state.selectedCharacter);
				selCharacter.trigger("change");
			}
		});

		return wrpPanel;
	}

	_renderCharacter (character) {
		const renderedHtml = Renderer.character.getCompactRenderedString(character, {isStatic: false});
		const eleStats = ee`<table class="ve-w-100 ve-stats"></table>`.html(renderedHtml);
		this._eleContent.empty().appends(eleStats);
		Renderer.character.bindListenersCompact(character, eleStats);
	}

	getState () {
		return {
			selectedCharacter: this._selCharacter?.val() || "",
		};
	}
}

export class PanelContentManager_Characters extends _PanelContentManager {
	static _PANEL_TYPE = PANEL_TYP_CHARACTERS;
	static _TITLE = "Characters";
	static _IS_STATELESS = false;

	static _ = this._register();

	_getPanelApp ({state}) {
		return CharactersPanelApp.getPanelApp({board: this._board, savedState: state});
	}
}
