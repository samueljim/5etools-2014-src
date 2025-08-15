class CharactersSublistManager extends SublistManager {
	constructor () {
		super({
			sublistListOptions: {
				fnSort: PageFilterCharacters.sortCharacters,
			},
			isSublistItemsCountable: false,
		});
	}

	_getCustomHashId ({entity}) {
		return entity.name;
	}

	static _getRowTemplate () {
		return [
			new SublistCellTemplate({
				name: "Name",
				css: "bold ve-col-5 pl-0 pr-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Class",
				css: "ve-col-3 px-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Level",
				css: "ve-col-1-7 px-1 ve-text-center",
				colStyle: "text-center",
			}),
			new SublistCellTemplate({
				name: "Race",
				css: "ve-col-2-3 pl-1 pr-0",
				colStyle: "",
			}),
		];
	}

	async pGetSublistItem (character, hash, {count = 1, customHashId = null} = {}) {
		const name = character.name;
		const characterClass = character.class ? character.class.name : "Unknown";
		const level = character.level || 1;
		const race = character.race ? character.race.name : "Unknown";

		const cellsText = [name, characterClass, level, race];

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst__row-border lst__row-inner">
				${this.constructor._getRowTemplate().map((it, i) => `<div class="${it.css}">${cellsText[i]}</div>`).join("")}
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			name,
			{
				hash,
				source: character.source || "HOMEBREW",
				level,
				class: characterClass,
				race,
			},
			{
				entity: character,
				mdRow: [...cellsText],
			},
		);

		return listItem;
	}
}

class CharactersPage extends ListPageMultiSource {
	constructor () {
		const pageFilter = new PageFilterCharacters();
		const pFnGetFluff = null; // Characters don't have fluff data

		super({
			pageFilter,
			listOptions: {
				fnSort: PageFilterCharacters.sortCharacters,
			},
			dataProps: ["character"],
			brewDataSource: () => this._pGetBrewData(),
			bookViewOptions: {
				$btnOpen: $(`#btn-book`),
				$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple characters, please first make a list</span>`),
				pageTitle: "Characters Book View",
				popTblGetNumShown: async ($wrpContent) => {
					return $wrpContent.find(`.character-statblock`).length;
				},
				hasPrintColumns: false,
			},
			tableViewOptions: {
				title: "Characters",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					level: {name: "Level"},
					class: {name: "Class"},
					race: {name: "Race"},
					background: {name: "Background"},
				},
			},
			propEntryData: "character",
			propLoader: "character",
			listSyntax: new ListSyntaxCharacters({fnGetDataList: () => this._dataList, pFnGetFluff: pFnGetFluff}),
		});

		this._sublistManager = new CharactersSublistManager();
	}

	// Override the primary list initialization to handle sorting errors gracefully
	async _pOnLoad_pInitPrimaryLists () {
		try {
			await super._pOnLoad_pInitPrimaryLists();
		} catch (error) {
			// If sorting initialization fails, try to initialize without sorting
			if (error.message && error.message.includes("addClass")) {
				// Initialize the list without sort handlers
				this._list = new List({
					$iptSearch: $(`#lst__search`),
					$wrpList: $(`.list`),
					fnSort: this._listOptions.fnSort,
				});

				// Initialize sublist without sort handlers
				this._listSub = new ListUiUtil.SubList({
					$wrpList: $(`#sublist`),
					fnSort: this._sublistManager.fnSort,
					fnGetSublistRow: this._sublistManager.fnGetSublistRow.bind(this._sublistManager),
					fnGetSublistItem: this._sublistManager.pGetSublistItem.bind(this._sublistManager),
				});

				// Initialize filter box
				await this._pageFilter.pInitFilterBox({
					$wrpFormTop: $(`#filter-search-group`).title("Hotkey: f"),
					$btnReset: $(`#reset`),
					$btnOpen: $(`#btn-filter`),
					$btnToggleSummaryHidden: $(`#btn-toggle-summary-hidden`),
					$wrpMiniPills: $(`.fltr__mini-view`),
					namespace: this._getNamespace(),
				});
			} else {
				throw error;
			}
		}
	}

	async _pGetBrewData () {
		try {
			const characters = await CharacterStorageUtil.pLoadCharacters();
			// Ensure we always return an array, even if empty
			return {character: Array.isArray(characters) ? characters : []};
		} catch (error) {
			// Log error and return empty array (development only)
			// console.warn("Failed to load characters:", error);
			return {character: []};
		}
	}

	// Override the primary list initialization to handle sorting errors gracefully
	async _pOnLoad_pInitPrimaryLists () {
		try {
			// Ensure DOM elements exist before initializing sorting
			const filterTools = document.getElementById("filtertools");
		if (!filterTools || !sublistSort) {
			// Wait a bit for DOM to be ready
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		await super._pOnLoad_pInitPrimaryLists();
		} catch (error) {
			// If sorting initialization fails, log the error but continue (development only)
			// console.warn("Sorting initialization failed, continuing without sort handlers:", error);

			// Try to initialize basic list functionality without sorting
			try {
				this._list = new List({
					$iptSearch: $(`#lst__search`),
					$wrpList: $(`.list`),
					fnSort: this._listOptions.fnSort,
				});

				this._listSub = new ListUiUtil.SubList({
					$wrpList: $(`#sublist`),
					fnSort: this._sublistManager.fnSort,
					fnGetSublistRow: this._sublistManager.fnGetSublistRow.bind(this._sublistManager),
					fnGetSublistItem: this._sublistManager.pGetSublistItem.bind(this._sublistManager),
				});

				await this._pageFilter.pInitFilterBox({
					$wrpFormTop: $(`#filter-search-group`).title("Hotkey: f"),
					$btnReset: $(`#reset`),
					$btnOpen: $(`#btn-filter`),
					$btnToggleSummaryHidden: $(`#btn-toggle-summary-hidden`),
					$wrpMiniPills: $(`.fltr__mini-view`),
					namespace: this._getNamespace(),
				});
			} catch (fallbackError) {
				// If even basic initialization fails, just log it (development only)
				// console.error("Failed to initialize basic list functionality:", fallbackError);
			}
		}
	}

	getListItem (character, chI) {
		const hash = UrlUtil.autoEncodeHash(character);
		if (this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		const isExcluded = ExcludeUtil.isExcluded(hash, "character", character.source);

		this._pageFilter.mutateAndAddToFilters(character, isExcluded);

		const source = Parser.sourceJsonToAbv(character.source || "HOMEBREW");
		const characterClass = character.class ? character.class.name : "Unknown";
		const level = character.level || 1;
		const race = character.race ? character.race.name : "Unknown";

		const eleLi = e_({
			tag: "div",
			clazz: `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`,
			click: (evt) => this._list.doSelect(listItem, evt),
			contextmenu: (evt) => this._openContextMenu(evt, this._list, listItem),
			children: [
				e_({
					tag: "a",
					href: `#${hash}`,
					clazz: "lst__row-border lst__row-inner",
					children: [
						e_({tag: "span", clazz: `bold ve-col-4-2 pl-0 pr-1`, text: character.name}),
						e_({tag: "span", clazz: `ve-col-3 px-1`, text: characterClass}),
						e_({tag: "span", clazz: `ve-col-1-7 px-1 ve-text-center`, text: level}),
						e_({
							tag: "span",
							clazz: `ve-col-2-3 ve-text-center ${Parser.sourceJsonToSourceClassname(character.source || "HOMEBREW")} pl-1 pr-0`,
							title: `${Parser.sourceJsonToFull(character.source || "HOMEBREW")}`,
							text: source,
						}),
					],
				}),
			],
		});

		const listItem = new ListItem(
			chI,
			eleLi,
			character.name,
			{
				hash,
				source,
				level,
				class: characterClass,
				race,
				...ListItem.getCommonValues(character),
			},
			{
				isExcluded,
			},
		);

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderCharacters.$getRenderedCharacter(ent));
	}

	async _pOnLoad_pPreDataLoad () {
		console.log("Initializing character creation button...");
		// Initialize character creation button with a slight delay to ensure DOM is ready
		setTimeout(() => {
			const addCharacterBtn = document.getElementById("btn-add-character");
			console.log("Looking for btn-add-character:", addCharacterBtn);
			if (addCharacterBtn) {
				console.log("Found Add Character button, adding event listener");
				addCharacterBtn.addEventListener("click", (e) => {
					console.log("Add Character button clicked!");
					e.preventDefault();
					this._pHandleAddCharacter().catch(err => {
						console.error("Error in _pHandleAddCharacter:", err);
					});
				});
			} else {
				console.error("Add Character button not found!");
			}
		}, 100);
	}

	async _pHandleAddCharacter () {
		console.log("Add Character button clicked - opening character creator");

		try {
			console.log("Creating CharacterCreator instance...");
			const characterCreator = new CharacterCreator();
			console.log("CharacterCreator created, calling pShow...");
			await characterCreator.pShow();
			console.log("Character creator shown successfully");
		} catch (error) {
			console.error("Error opening character creator:", error);

			// Show user-friendly error message
			if (typeof JqueryUtil !== "undefined" && JqueryUtil.doToast) {
				JqueryUtil.doToast({
					content: "Failed to open character creator. Please try again.",
					type: "danger",
				});
			} else {
				alert("Failed to open character creator. Please try again.");
			}
		}
	}

	async _pDoLoadHash ({id, lockToken}) {
		const character = this._dataList[id];
		if (!character) return;

		this._renderStats_doBuildStatsTab({ent: character});
		await this._pDoLoadSubHash({sub: [], lockToken});
		this._updateSelected();
	}

	async _pDoLoadSubHash ({sub, lockToken}) {
		sub = await super._pDoLoadSubHash({sub, lockToken});
		// Handle character-specific subhashes if needed in the future
		return sub;
	}
}




// Character list syntax for search integration
class ListSyntaxCharacters extends ListUiUtil.ListSyntax {
	_getSearchCacheStats (entity) {
		const ptrOut = {_: ""};

		// Add searchable content from character features
		if (entity.customNotes) {
			ptrOut._ += ` ${entity.customNotes}`;
		}

		if (entity.customFeatures) {
			entity.customFeatures.forEach(feature => {
				ptrOut._ += ` ${feature.name} ${feature.description || ""}`;
			});
		}

		// Add class and race information for search
		if (entity.class) ptrOut._ += ` ${entity.class.name}`;
		if (entity.race) ptrOut._ += ` ${entity.race.name}`;
		if (entity.background) ptrOut._ += ` ${entity.background.name}`;

		return ptrOut._;
	}
}

// Fantasy name generator for character creation
class FantasyNameGenerator {
	static _firstNames = [
		// Human-style names
		"Aeliana", "Aldric", "Aria", "Bran", "Celia", "Darius", "Elara", "Finn", "Gwendolyn", "Hadrian",
		"Isla", "Jasper", "Kira", "Leander", "Mira", "Nolan", "Ophelia", "Percival", "Quinn", "Rhea",
		"Soren", "Thalia", "Ulric", "Vera", "Willem", "Xara", "Yorick", "Zara",
		// Elvish-style names
		"Aerdrie", "Berrian", "Caelynn", "Dayereth", "Enna", "Faelar", "Galinndan", "Halimath", "Ivellios", "Jhaan",
		"Korfel", "Lamlis", "Mindartis", "Naal", "Otaehryn", "Peren", "Quarion", "Riardon", "Silvyr", "Thamior",
		"Uldreyin", "Vanuath", "Wistari", "Xhalph", "Yhendorn", "Zaltarish",
		// Dwarven-style names
		"Adrik", "Baern", "Darrak", "Eberk", "Fargrim", "Gardain", "Harbek", "Kildrak", "Morgran", "Orsik",
		"Rangrim", "Taklinn", "Thorek", "Ulfgar", "Vondal", "Amber", "Bardryn", "Diesa", "Gunnloda", "Hlin",
		"Kathra", "Kristryd", "Ilde", "Liftrasa", "Mardred", "Riswynn", "Sannl", "Torbera", "Vistra",
		// Halfling-style names
		"Alton", "Ander", "Bernie", "Bobbin", "Cade", "Callus", "Corrin", "Dannad", "Garret", "Lindal",
		"Lyle", "Merric", "Milo", "Osborn", "Perrin", "Reed", "Roscoe", "Wellby", "Andry", "Bree",
		"Callie", "Cora", "Euphemia", "Jillian", "Kithri", "Lavinia", "Lidda", "Merla", "Nedda", "Paela",
		"Portia", "Seraphina", "Shaena", "Trym", "Vani", "Verna",
		// Dragonborn-style names
		"Arjhan", "Balasar", "Bharash", "Donaar", "Ghesh", "Heskan", "Kriv", "Medrash", "Mehen", "Nadarr",
		"Pandjed", "Patrin", "Rhogar", "Shamash", "Shedinn", "Tarhun", "Torinn", "Akra", "Biri", "Daar",
		"Farideh", "Harann", "Havilar", "Jheri", "Kava", "Korinn", "Mishann", "Nala", "Perra", "Raiann",
		"Sora", "Surina", "Thava", "Uadjit",
		// Tiefling-style names
		"Akmenos", "Amnon", "Barakas", "Damakos", "Ekemon", "Iados", "Kairon", "Leucis", "Melech", "Mordai",
		"Morthos", "Pelaios", "Skamos", "Therai", "Akta", "Anakir", "Bryseis", "Criella", "Damaia", "Ea",
		"Kallista", "Lerissa", "Makaria", "Nemeia", "Orianna", "Phelaia", "Rieta"
	];

	static _lastNames = [
		// Human-style surnames
		"Blackwater", "Brightblade", "Helder", "Hornraven", "Lackman", "Stormwind", "Windrivver",
		"Amakir", "Amakos", "Boernann", "Drannor", "Erevan", "Galinndan", "Hadarai", "Immeral", "Ivellios",
		"Laucian", "Mindartis", "Naal", "Nutae", "Paelinn", "Peren", "Quarion", "Riluaneth", "Rolen",
		"Silvyr", "Suhnaal", "Thamior", "Theriatis", "Therivan", "Uthemar", "Vanuath", "Varis",
		// Dwarven clan names
		"Battlehammer", "Brawnanvil", "Dankil", "Fireforge", "Frostbeard", "Gorunn", "Holderhek", "Ironfist",
		"Loderr", "Lutgehr", "Rumnaheim", "Strakeln", "Torunn", "Ungart",
		// Halfling family names
		"Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Hilltopple", "Leagallow", "Tealeaf",
		"Thorngage", "Tosscobble", "Underbough",
		// Dragonborn clan names
		"Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Fenkenkabradon", "Kepeshkmolik",
		"Kerrhylon", "Kimbatuul", "Linxakasendalor", "Myastan", "Nemmonis", "Norixius", "Ophinshtalajiir",
		"Prexijandilin", "Shestendeliath", "Turnuroth", "Verthisathurgiesh", "Yarjerit",
		// Fantasy surnames
		"Shadowmere", "Goldleaf", "Ironforge", "Swiftarrow", "Moonwhisper", "Starweaver", "Flameheart",
		"Frostborn", "Stormcaller", "Earthshaker", "Nightfall", "Dawnbreaker", "Thornfield", "Ravencrest",
		"Silverstone", "Darkbane", "Lightbringer", "Wildheart", "Steelwind", "Emberfall"
	];

	/**
	 * Generates a random fantasy name
	 * @returns {string} A random fantasy name
	 */
	static generateRandomName() {
		const firstName = this._firstNames[Math.floor(Math.random() * this._firstNames.length)];
		const lastName = this._lastNames[Math.floor(Math.random() * this._lastNames.length)];
		return `${firstName} ${lastName}`;
	}

	/**
	 * Generates a random first name only
	 * @returns {string} A random first name
	 */
	static generateRandomFirstName() {
		return this._firstNames[Math.floor(Math.random() * this._firstNames.length)];
	}
}

// Character creation wizard
class CharacterCreator {
	constructor () {
		console.log("CharacterCreator constructor called");
		console.log("CharacterUtil available:", typeof CharacterUtil);
		this._$modal = null;
		this._currentStep = 0;

		if (typeof CharacterUtil === 'undefined') {
			console.error("CharacterUtil is not available!");
			this._characterData = {
				name: "",
				level: 1,
				race: null,
				class: null,
				background: null,
				abilityScores: {
					str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
				},
				hitPoints: { max: 1, current: 1, temp: 0 },
				customNotes: "",
				customFeatures: []
			};
		} else {
			this._characterData = CharacterUtil.getDefaultCharacterData();
		}
		this._raceOptions = [];
		this._subraceOptions = [];
		this._classOptions = [];
		this._subclassOptions = [];
		this._selectedClass = null;
		this._selectedSubclass = null;
		this._availableSubclasses = [];
		// Track search states to preserve when navigating between steps
		this._searchStates = {
			raceSearch: "",
			classSearch: "",
			subclassSearch: ""
		};
		this._steps = [
			{
				title: "Basic Information",
				render: () => this._renderBasicInfoStep(),
				validate: () => this._validateBasicInfo(),
			},
			{
				title: "Race Selection",
				render: () => this._renderRaceSelectionStep(),
				validate: () => this._validateRaceSelection(),
			},
			{
				title: "Class Selection",
				render: () => this._renderClassSelectionStep(),
				validate: () => this._validateClassSelection(),
			},
			{
				title: "Subclass Selection",
				render: () => this._renderSubclassSelectionStep(),
				validate: () => this._validateSubclassSelection(),
			},
		];
	}

	async pShow () {
		console.log("CharacterCreator.pShow() called");

		this._currentStep = 0;
		this._characterData = CharacterUtil.getDefaultCharacterData();

		// Generate a random fantasy name as default
		this._characterData.name = FantasyNameGenerator.generateRandomName();

		// Check if required utilities are available
		console.log("UiUtil available:", typeof UiUtil);
		console.log("UiUtil.getShowModal available:", typeof UiUtil !== 'undefined' && typeof UiUtil.getShowModal);

		if (typeof UiUtil === "undefined" || !UiUtil.getShowModal) {
			const error = "UiUtil.getShowModal is not available";
			console.error(error);
			throw new Error(error);
		}

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: "Create New Character",
			isMinHeight0: true,
			isWidth100: false,
			isUncappedHeight: true,
		});

		this._doClose = doClose;
		this._$modalInner = $modalInner;

		this._renderModalContent();

		// Log success (development only)
		// console.log("Character creator modal opened successfully");
	}

	_renderModalContent () {
		const progressPercent = ((this._currentStep + 1) / this._steps.length) * 100;
		const stepTitle = this._steps[this._currentStep].title;
		const stepContent = this._steps[this._currentStep].render();
		const isLastStep = this._currentStep === this._steps.length - 1;

		console.log(`Rendering step ${this._currentStep}: ${stepTitle}`);
		console.log(`Total steps: ${this._steps.length}`);

		this._$modalInner.html(`
			<style>
				/* Fix z-index issue to allow hover popups */
				.ui-modal__overlay {
					z-index: 199 !important;
				}
				.ui-modal__inner {
					z-index: 200 !important;
				}

				/* Character creator styles matching 5etools theme */
				.character-creator-progress {
					margin-bottom: 20px;
				}

				/* Name generator button styles */
				#btn-generate-name {
					border-left: none;
					font-size: 16px;
					padding: 8px 12px;
					background-color: #f8f9fa;
					border-color: #ced4da;
					color: #495057;
					transition: all 0.2s ease;
				}
				#btn-generate-name:hover {
					background-color: #e9ecef;
					border-color: #adb5bd;
					color: #495057;
					transform: scale(1.1);
				}
				#btn-generate-name:active {
					transform: scale(0.95);
				}
				.ve-night-mode #btn-generate-name {
					background-color: #495057;
					border-color: #6c757d;
					color: #e9ecef;
				}
				.ve-night-mode #btn-generate-name:hover {
					background-color: #6c757d;
					border-color: #adb5bd;
					color: #fff;
				}
				.character-creator-content {
					flex: 1;
					overflow-y: auto;
				}
				.character-creator-footer {
					margin-top: 20px;
					display: flex;
					justify-content: flex-end;
					gap: 8px;
					padding-top: 15px;
					border-top: 1px solid #e69a28;
				}
				.step-indicator {
					text-align: center;
					margin-top: 8px;
					font-weight: 500;
					color: #822000;
					font-family: "Times New Roman", serif;
					font-variant: small-caps;
				}
				.race-list-container, .class-list-container {
					max-height: 400px;
					overflow-y: auto;
					border: 1px solid #e69a28;
					border-radius: 4px;
					background-color: #fdf1dc;
				}
				.race-list, .class-list {
					padding: 0;
				}
				.race-card {
					border-bottom: 1px solid #e69a28;
					padding: 12px 16px;
					cursor: pointer;
					transition: all 0.2s ease;
					position: relative;
					font-family: Convergence, Arial, sans-serif;
					background-color: #fdf1dc;
				}
				.race-card:hover {
					background-color: #fff;
					border-left: 4px solid #822000;
					padding-left: 12px;
				}
				.race-card:last-child {
					border-bottom: none;
				}
				.race-card.selected {
					background-color: #fff;
					border-left: 4px solid #822000;
					padding-left: 12px;
					box-shadow: inset 0 0 0 1px #822000;
				}
				.race-card-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 8px;
				}
				.race-card-name {
					font-weight: bold;
					font-size: 16px;
					color: #822000;
					font-family: "Times New Roman", serif;
					font-variant: small-caps;
				}
				.race-card-source {
					font-size: 12px;
					background-color: #e69a28;
					color: #fff;
					padding: 2px 6px;
					border-radius: 3px;
					font-weight: bold;
				}
				.race-card-details {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 8px;
					margin-bottom: 8px;
					font-size: 13px;
				}
				.race-card-detail {
					color: #333;
				}
				.race-card-detail strong {
					color: #822000;
				}
				.race-card-traits {
					font-size: 12px;
					color: #555;
					line-height: 1.3;
				}
				.race-card-asi {
					font-size: 13px;
					color: #2e7d32;
					font-weight: 500;
					margin-bottom: 4px;
				}
				.race-card-subrace-indicator {
					font-size: 11px;
					color: #e69a28;
					font-weight: 500;
					margin-top: 4px;
				}
				.race-card-hidden {
					display: none;
				}
				.race-details {
					border: 1px solid #e69a28;
					border-radius: 4px;
					background-color: #fdf1dc;
					max-height: 400px;
					overflow-y: auto;
					padding: 16px;
					font-family: Convergence, Arial, sans-serif;
				}
				.race-details h3 {
					margin-top: 0;
					color: #822000;
					border-bottom: 2px solid #e69a28;
					padding-bottom: 8px;
					font-family: "Times New Roman", serif;
					font-variant: small-caps;
				}
				.race-details .race-ability-scores {
					background-color: #fff;
					padding: 12px;
					border-radius: 4px;
					margin: 12px 0;
					border: 1px solid #e69a28;
				}
				.race-details .race-trait {
					margin: 12px 0;
					padding: 8px;
					border-left: 3px solid #e69a28;
					background-color: #fff;
				}
				.race-details .race-trait-name {
					font-weight: bold;
					color: #822000;
					margin-bottom: 4px;
					font-family: "Times New Roman", serif;
					font-variant: small-caps;
				}

				/* Night mode support */
				.ve-night-mode .character-creator-footer {
					border-top-color: #565656;
				}
				.ve-night-mode .step-indicator {
					color: #d29a38;
				}
				.ve-night-mode .race-list-container {
					border-color: #565656;
					background-color: #222;
				}
				.ve-night-mode .race-card {
					border-bottom-color: #565656;
					background-color: #222;
				}
				.ve-night-mode .race-card:hover {
					background-color: #333;
					border-left-color: #d29a38;
				}
				.ve-night-mode .race-card.selected {
					background-color: #333;
					border-left-color: #d29a38;
					box-shadow: inset 0 0 0 1px #d29a38;
				}
				.ve-night-mode .race-card-name {
					color: #d29a38;
				}
				.ve-night-mode .race-card-source {
					background-color: #565656;
					color: #bbb;
				}
				.ve-night-mode .race-card-detail {
					color: #bbb;
				}
				.ve-night-mode .race-card-detail strong {
					color: #d29a38;
				}
				.ve-night-mode .race-card-traits {
					color: #999;
				}
				.ve-night-mode .race-card-subrace-indicator {
					color: #565656;
				}
				.ve-night-mode .race-details {
					border-color: #565656;
					background-color: #222;
				}
				.ve-night-mode .race-details h3 {
					color: #d29a38;
					border-bottom-color: #565656;
				}
				.ve-night-mode .race-details .race-ability-scores {
					background-color: #333;
					border-color: #565656;
				}
				.ve-night-mode .race-details .race-trait {
					border-left-color: #565656;
					background-color: #333;
				}
				.ve-night-mode .race-details .race-trait-name {
					color: #d29a38;
				}

				/* Class card styles */
				.class-card {
					border-bottom: 1px solid #e69a28;
					padding: 12px 16px;
					cursor: pointer;
					transition: all 0.2s ease;
					position: relative;
					font-family: Convergence, Arial, sans-serif;
					background-color: #fdf1dc;
				}
				.class-card:hover {
					background-color: #fff;
					border-left: 4px solid #822000;
					padding-left: 12px;
				}
				.class-card:last-child {
					border-bottom: none;
				}
				.class-card.selected {
					background-color: #fff;
					border-left: 4px solid #822000;
					padding-left: 12px;
					box-shadow: inset 0 0 0 1px #822000;
				}
				.class-card-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 8px;
				}
				.class-card-name {
					font-weight: bold;
					font-size: 16px;
					color: #822000;
					font-family: "Times New Roman", serif;
					font-variant: small-caps;
				}
				.class-card-source {
					font-size: 12px;
					background-color: #e69a28;
					color: #fff;
					padding: 2px 6px;
					border-radius: 3px;
					font-weight: bold;
				}
				.class-card-details {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 8px;
					margin-bottom: 8px;
					font-size: 13px;
				}
				.class-card-detail {
					color: #333;
				}
				.class-card-detail strong {
					color: #822000;
				}
				.class-card-primary {
					font-size: 13px;
					color: #2e7d32;
					font-weight: 500;
					margin-bottom: 4px;
				}
				.class-card-type {
					font-size: 12px;
					color: #555;
					line-height: 1.3;
				}

				/* Night mode class card styles */
				.ve-night-mode .class-card {
					border-bottom-color: #565656;
					background-color: #222;
				}
				.ve-night-mode .class-card:hover {
					background-color: #333;
					border-left-color: #d29a38;
				}
				.ve-night-mode .class-card.selected {
					background-color: #333;
					border-left-color: #d29a38;
					box-shadow: inset 0 0 0 1px #d29a38;
				}
				.ve-night-mode .class-card-name {
					color: #d29a38;
				}
				.ve-night-mode .class-card-source {
					background-color: #565656;
					color: #bbb;
				}
				.ve-night-mode .class-card-detail {
					color: #bbb;
				}
				.ve-night-mode .class-card-detail strong {
					color: #d29a38;
				}
				.ve-night-mode .class-card-type {
					color: #999;
				}
			</style>
			<div class="character-creator-progress">
				<div class="progress">
					<div class="progress-bar" role="progressbar" style="width: ${progressPercent}%"></div>
				</div>
				<div class="step-indicator">
					Step ${this._currentStep + 1} of ${this._steps.length}: ${stepTitle}
				</div>
			</div>
			<div class="character-creator-content">
				${stepContent}
			</div>
			<div class="character-creator-footer">
				<button type="button" class="ve-btn ve-btn-default" id="btn-cancel">Cancel</button>
				<button type="button" class="ve-btn ve-btn-default" id="btn-prev-step" ${this._currentStep === 0 ? "disabled" : ""}>Previous</button>
				<button type="button" class="ve-btn ve-btn-primary" id="btn-next-step">${isLastStep ? "Create Character" : "Next"}</button>
			</div>
		`);

		// Wire up event handlers
		this._$modalInner.find("#btn-next-step").off("click").on("click", () => this._handleNextStep());
		this._$modalInner.find("#btn-prev-step").off("click").on("click", () => this._handlePrevStep());
		this._$modalInner.find("#btn-cancel").off("click").on("click", () => this._doClose());

		// Step-specific initialization
		console.log(`Initializing step ${this._currentStep}`);
		if (this._currentStep === 0) {
			// Basic info step
			console.log("Initializing basic info step");
			this._$modalInner.find("#character-name").off("input").on("input", (e) => {
				this._characterData.name = $(e.target).val();
				this._validateNameRealTime();
			});
			this._$modalInner.find("#character-level").off("change").on("change", (e) => {
				this._characterData.level = parseInt($(e.target).val()) || 1;
			});
			this._$modalInner.find("#btn-generate-name").off("click").on("click", () => this._generateRandomName());
		} else if (this._currentStep === 1) {
			// Race selection step
			console.log("Initializing race selection step");
			this._initializeRaceSelection();
		} else if (this._currentStep === 2) {
			// Class selection step
			console.log("Initializing class selection step");
			document.title = "Step 2: Class Selection - 5etools"; // Visual confirmation
			this._initializeClassSelection();
		} else if (this._currentStep === 3) {
			// Subclass selection step
			console.log("Initializing subclass selection step");
			document.title = "Step 3: Subclass Selection - 5etools"; // Visual confirmation
			this._initializeSubclassSelection();
		}
	}

	/**
	 * Callback for when class selection changes
	 * @private
	 */
	_onClassSelectionChange() {
		// This method is called by the class selector when selection changes
		// Can be used to update UI or perform other actions
		console.log("Class selection changed");
	}

	_renderBasicInfoStep () {
		return `
			<div class="ve-flex-col">
				<div class="form-group">
					<label for="character-name" class="ve-flex-v-center">
						<span>Character Name</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<input
						type="text"
						class="form-control"
						id="character-name"
						placeholder="Enter your character's name"
						value="${this._characterData.name || ""}"
						maxlength="100"
						required
						autocomplete="off"
					>
					</div>
					<div class="input-group-append">
					<button type="button" class="ve-btn ve-btn-default" id="btn-generate-name" title="Generate random name">
					🎲
					</button>
					</div>
					<div class="invalid-feedback" id="name-error"></div>
				</div>

				<div class="form-group">
					<label for="character-level" class="ve-flex-v-center">
						<span>Starting Level</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<select class="form-control" id="character-level" style="height: fit-content;">
						${Array.from({length: 20}, (_, i) => i + 1).map(level =>
							`<option value="${level}" ${this._characterData.level === level ? "selected" : ""}>${level}</option>`,
						).join("")}
					</select>
					<small class="form-text text-muted">Select your character's starting level (1-20)</small>
				</div>

				<div class="form-group">
					<label for="character-notes">Notes (Optional)</label>
					<textarea
						class="form-control"
						id="character-notes"
						rows="4"
						placeholder="Add any notes about your character's background, personality, or campaign-specific details..."
						maxlength="1000"
					>${this._characterData.customNotes || ""}</textarea>
					<small class="form-text text-muted">Optional notes about your character (max 1000 characters)</small>
				</div>

				<div class="alert alert-info">
					<strong>Getting Started:</strong> This wizard will help you create a basic character.
					You can add race, class, and other details later by editing the character.
				</div>
			</div>
		`;
	}

	_validateNameRealTime () {
		const name = this._$modalInner.find("#character-name").val().trim();
		const $nameField = this._$modalInner.find("#character-name");
		const $nameError = this._$modalInner.find("#name-error");

		// Clear previous validation state
		$nameField.removeClass("is-invalid is-valid");
		$nameError.text("");

		if (name.length === 0) {
			// Don't show error for empty field during typing
			return;
		}

		if (name.length > 100) {
			$nameField.addClass("is-invalid");
			$nameError.text("Character name must be 100 characters or less");
		} else {
			$nameField.addClass("is-valid");
		}
	}

	_generateRandomName () {
		const newName = FantasyNameGenerator.generateRandomName();
		const $nameField = this._$modalInner.find("#character-name");

		// Set the new name
		$nameField.val(newName);

		// Update character data
		this._characterData.name = newName;

		// Trigger validation
		this._validateNameRealTime();

		// Add a subtle animation to indicate the name changed
		$nameField.addClass("is-valid");
		setTimeout(() => {
			$nameField.removeClass("is-valid");
		}, 1000);
	}

	_validateBasicInfo () {
		const name = this._$modalInner.find("#character-name").val().trim();
		const level = parseInt(this._$modalInner.find("#character-level").val());
		const notes = this._$modalInner.find("#character-notes").val().trim();

		// Clear previous errors
		this._$modalInner.find(".form-control").removeClass("is-invalid is-valid");
		this._$modalInner.find(".invalid-feedback").text("");

		let isValid = true;

		// Validate name
		if (!name) {
			this._$modalInner.find("#character-name").addClass("is-invalid");
			this._$modalInner.find("#name-error").text("Character name is required");
			isValid = false;
		} else if (name.length > 100) {
			this._$modalInner.find("#character-name").addClass("is-invalid");
			this._$modalInner.find("#name-error").text("Character name must be 100 characters or less");
			isValid = false;
		} else {
			this._$modalInner.find("#character-name").addClass("is-valid");
		}

		// Validate level (should always be valid from dropdown, but check anyway)
		if (!Number.isInteger(level) || level < 1 || level > 20) {
			isValid = false;
		}

		// Validate notes length
		if (notes.length > 1000) {
			this._$modalInner.find("#character-notes").addClass("is-invalid");
			isValid = false;
		}

		// Update character data if valid
		if (isValid) {
			this._characterData.name = name;
			this._characterData.level = level;
			this._characterData.customNotes = notes;
		}

		return isValid;
	}

	_renderRaceSelectionStep () {
		return `
			<div class="ve-flex-col">
				<div class="form-group">
					<label class="ve-flex-v-center">
						<span>Choose Your Race</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<div class="invalid-feedback" id="race-error"></div>
					<small class="form-text text-muted">Browse races below and click to select. Use the search to filter results.</small>
				</div>

				<div class="form-group">
					<input
						type="text"
						class="form-control"
						id="race-search"
						placeholder="Search races by name..."
						autocomplete="off"
					>
				</div>



				<div class="form-group" id="subrace-group" style="display: none;">
					<label for="character-subrace" class="ve-flex-v-center">
						<span>Subrace</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<select class="form-control" id="character-subrace">
						<option value="">Select a subrace...</option>
					</select>
					<div class="invalid-feedback" id="subrace-error"></div>
					<small class="form-text text-muted">This race has multiple subraces - choose one</small>
				</div>

				<div class="ve-flex">
					<div class="ve-col-4 pr-2">
						<div id="race-list-container" class="race-list-container">
							<div id="race-list" class="race-list">
								<div class="text-center p-3">
									<div class="spinner-border" role="status">
										<span class="sr-only">Loading races...</span>
									</div>
									<div class="mt-2">Loading races...</div>
								</div>
							</div>
						</div>
					</div>
					<div class="ve-col-8 pl-2">
						<div id="race-details" class="race-details" style="display: none;">
							<div class="alert alert-info">
								<strong>Race Details</strong>
								<p class="mb-0">Select a race from the list to view detailed information here.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	async _validateRaceSelection () {
		const subraceValue = this._$modalInner.find("#character-subrace").val();

		// Clear previous errors
		this._$modalInner.find(".form-control").removeClass("is-invalid is-valid");
		this._$modalInner.find(".invalid-feedback").text("");

		let isValid = true;

		// Validate race selection
		if (!this._selectedRace) {
			this._$modalInner.find("#race-search").addClass("is-invalid");
			this._$modalInner.find("#race-error").text("Race selection is required");
			isValid = false;
		} else {
			this._$modalInner.find("#race-search").addClass("is-valid");
		}

		// Validate subrace if subrace dropdown is visible and has options
		const $subraceGroup = this._$modalInner.find("#subrace-group");
		const $subraceSelect = this._$modalInner.find("#character-subrace");

		if ($subraceGroup.is(":visible") && $subraceSelect.find("option").length > 1) {
			if (!subraceValue) {
				$subraceSelect.addClass("is-invalid");
				this._$modalInner.find("#subrace-error").text("Subrace selection is required");
				isValid = false;
			} else {
				$subraceSelect.addClass("is-valid");
			}
		}

		// Apply race to character if valid
		if (isValid && this._selectedRace) {
			try {
				// Apply race using CharacterRaceUtil
				// If a subrace was selected directly, use that; otherwise use the dropdown value
				const finalSubrace = this._selectedRace.subrace || subraceValue || null;

				this._characterData = await CharacterRaceUtil.pApplyRaceToCharacter(
					this._characterData,
					this._selectedRace.name,
					this._selectedRace.source,
					finalSubrace
				);
			} catch (error) {
				console.error("Failed to apply race to character:", error);
				this._$modalInner.find("#race-search").addClass("is-invalid");
				this._$modalInner.find("#race-error").text("Failed to apply race features");
				isValid = false;
			}
		}

		return isValid;
	}

	async _handleNextStep () {
		// Validate current step
		if (!(await this._steps[this._currentStep].validate())) {
			return;
		}

		// If this is the last step, create the character
		if (this._currentStep === this._steps.length - 1) {
			await this._createCharacter();
			return;
		}

		// Move to next step
		this._currentStep++;
		console.log(`Moving to step ${this._currentStep}: ${this._steps[this._currentStep].title}`);
		this._renderModalContent();
	}

	_handlePrevStep () {
		if (this._currentStep > 0) {
			this._currentStep--;
			this._renderModalContent();
		}
	}

	async _initializeRaceSelection () {
		try {
			// Load raw race data to get both races and subraces separately
			const rawRaceData = await DataUtil.loadJSON("data/races.json");
			this._allRaces = rawRaceData.race || [];
			this._allSubraces = rawRaceData.subrace || [];
			// Don't reset selected race if returning to this step
			if (!this._selectedRace) {
				this._selectedRace = null;
			}

			// Set up event handlers
			const $raceSearch = this._$modalInner.find("#race-search");
			// Restore previous search value
			$raceSearch.val(this._searchStates.raceSearch);
			$raceSearch.off("input").on("input", (e) => {
				this._searchStates.raceSearch = $(e.target).val();
				this._handleRaceSearch();
			});

			this._$modalInner.find("#character-subrace").off("change").on("change", () => this._handleSubraceChange());

			// Load and display races
			await this._loadAndDisplayRaces();

		} catch (error) {
			console.error("Failed to initialize race selection:", error);
			const $raceList = this._$modalInner.find("#race-list");
			$raceList.html(`
				<div class="text-center p-3 text-danger">
					<div class="mb-2">Failed to load races</div>
					<div class="small">Please refresh and try again</div>
				</div>
			`);
		}
	}

	async _loadAndDisplayRaces () {
		const $raceList = this._$modalInner.find("#race-list");

		if (!this._allRaces || this._allRaces.length === 0) {
			$raceList.html(`
				<div class="text-center p-3">
					<div class="mb-2">No races found</div>
					<div class="small text-muted">Check your data files</div>
				</div>
			`);
			return;
		}

		// Combine races and subraces for selection
		const allSelectableRaces = [...this._allRaces];

		// Add subraces as selectable options with parent race name
		if (this._allSubraces) {
			this._allSubraces.forEach(subrace => {
				// Create a pseudo-race entry for the subrace
				const subraceAsRace = {
					...subrace,
					name: `${subrace.raceName} (${subrace.name})`,
					source: subrace.source,
					_isSubrace: true,
					_parentRaceName: subrace.raceName,
					_parentRaceSource: subrace.raceSource,
					_subraceName: subrace.name
				};
				allSelectableRaces.push(subraceAsRace);
			});
		}

		// Sort all selectable races by name
		const sortedRaces = allSelectableRaces.sort((a, b) => a.name.localeCompare(b.name));

		// Generate race cards
		const raceCardsHtml = sortedRaces.map(race => this._generateRaceCard(race)).join('');

		$raceList.html(raceCardsHtml);

		// Add click handlers to race cards
		$raceList.find('.race-card').off('click').on('click', (e) => {
			const raceValue = $(e.currentTarget).data('race-value');
			this._selectRaceFromCard(raceValue);
		});

		// Restore previously selected race if returning to this step
		if (this._selectedRace && this._selectedRace.value) {
			this._selectRaceFromCard(this._selectedRace.value);
		}
		// Auto-select the first race by default only if no race is already selected
		else if (sortedRaces.length > 0) {
			const firstRace = sortedRaces[0];
			this._selectRaceFromCard(`${firstRace.name}|${firstRace.source}`);
		}
	}

	_generateRaceCard (race) {
		const source = Parser.sourceJsonToAbv(race.source);
		const sourceFull = Parser.sourceJsonToFull(race.source);
		const size = Renderer.race.getRenderedSize(race);
		const speed = race.speed?.walk || race.speed || 30;

		// Get ability score improvements summary
		let asiSummary = "None";
		if (race.ability && race.ability.length > 0) {
			const asiParts = [];
			race.ability.forEach(asi => {
				Parser.ABIL_ABVS.forEach(ability => {
					if (asi[ability]) {
						asiParts.push(`${ability.toUpperCase()} +${asi[ability]}`);
					}
				});
				if (asi.choose) {
					if (asi.choose.from) {
						const amount = asi.choose.amount || 1;
						const count = asi.choose.count || 1;
						asiParts.push(`+${amount} to ${count} abilities of choice`);
					} else if (asi.choose.weighted) {
						asiParts.push(`Choice of ability improvements`);
					}
				}
			});
			if (asiParts.length > 0) {
				asiSummary = asiParts.slice(0, 2).join(", ");
				if (asiParts.length > 2) asiSummary += "...";
			}
		}

		// Check for subraces in the separate subraces array
		const hasSubraces = race._isSubrace ? false : this._allSubraces.some(subrace =>
			subrace.raceName === race.name && subrace.raceSource === race.source
		);

		// Get trait count
		const traitCount = race.entries ? race.entries.filter(e => e.name).length : 0;

		return `
			<div class="race-card" data-race-value="${race.name}|${race.source}">
				<div class="race-card-header">
					<div class="race-card-name">${race.name}</div>
					<div class="race-card-source">${source}</div>
				</div>
				<div class="race-card-details">
					<div class="race-card-detail"><strong>Size:</strong> ${size}</div>
					<div class="race-card-detail"><strong>Speed:</strong> ${speed} ft.</div>
				</div>
				<div class="race-card-asi">${asiSummary}</div>
				<div class="race-card-traits">
					${traitCount} racial trait${traitCount !== 1 ? 's' : ''}
					${hasSubraces ? `<div class="race-card-subrace-indicator">Has subraces</div>` : ''}
				</div>
			</div>
		`;
	}

	_handleRaceSearch () {
		const searchTerm = this._$modalInner.find("#race-search").val().toLowerCase().trim();
		const $raceCards = this._$modalInner.find(".race-card");
		let firstVisibleRace = null;

		$raceCards.each((i, card) => {
			const $card = $(card);
			const raceName = $card.find(".race-card-name").text().toLowerCase();
			const raceSource = $card.find(".race-card-source").text().toLowerCase();

			if (!searchTerm || raceName.includes(searchTerm) || raceSource.includes(searchTerm)) {
				$card.show();
				if (!firstVisibleRace) {
					firstVisibleRace = $card.data('race-value');
				}
			} else {
				$card.hide();
			}
		});

		// Auto-select the first visible race after search
		if (firstVisibleRace && searchTerm) {
			this._selectRaceFromCard(firstVisibleRace);
		}
	}

	_selectRaceFromCard (raceValue) {
		const [raceName, raceSource] = raceValue.split("|");

		// First check if it's a regular race
		let race = this._allRaces.find(r => r.name === raceName && r.source === raceSource);

		// If not found, check if it's a subrace (formatted as "Parent (Subrace)")
		if (!race && this._allSubraces) {
			const subraceEntry = this._allSubraces.find(sr =>
				`${sr.raceName} (${sr.name})` === raceName && sr.source === raceSource
			);

			if (subraceEntry) {
				// Create a pseudo-race object for the subrace
				race = {
					...subraceEntry,
					name: raceName,
					source: raceSource,
					_isSubrace: true,
					_parentRaceName: subraceEntry.raceName,
					_parentRaceSource: subraceEntry.raceSource,
					_subraceName: subraceEntry.name
				};
			}
		}

		if (!race) return;

		// Update selected race
		if (race._isSubrace) {
			// For subraces, we need to store the parent race info
			this._selectedRace = {
				name: race._parentRaceName,
				source: race._parentRaceSource,
				subrace: race._subraceName,
				value: raceValue,
				race: race,
				displayName: raceName // Keep the display name for UI
			};
		} else {
			// For regular races
			this._selectedRace = {
				name: raceName,
				source: raceSource,
				subrace: null,
				value: raceValue,
				race: race,
				displayName: raceName
			};
		}

		// Update UI
		this._updateRaceSelection(race);
		this._displayRaceDetails(race);
	}

	_updateRaceSelection (race) {
		// Clear previous selection
		this._$modalInner.find(".race-card").removeClass("selected");

		// Mark selected card
		this._$modalInner.find(`.race-card[data-race-value="${race.name}|${race.source}"]`).addClass("selected");

		// Handle subraces - use parent race info if this is a subrace
		if (race._isSubrace) {
			this._handleRaceChange(race._parentRaceName, race._parentRaceSource);
			// If a subrace is selected directly, hide the subrace dropdown since it's already chosen
			this._$modalInner.find("#subrace-group").hide();
		} else {
			this._handleRaceChange(race.name, race.source);
		}
	}

	async _displayRaceDetails (race) {
		const $raceDetails = this._$modalInner.find("#race-details");

		try {
			// Use the 5etools renderer to get detailed race information
			const renderedRace = Renderer.race.getCompactRenderedString(race, {isStatic: true});

			$raceDetails.html(`
				<div class="race-details-content">
					${renderedRace}
				</div>
			`);

			$raceDetails.show();
		} catch (error) {
			console.error("Failed to render race details:", error);
			$raceDetails.html(`
				<div class="alert alert-warning">
					<h4>${race.name}</h4>
					<p>Unable to load detailed race information. Please try selecting another race.</p>
				</div>
			`);
			$raceDetails.show();
		}
	}	_clearRaceSelection () {
		this._selectedRace = null;
		this._$modalInner.find("#race-search").val('').focus();
		this._$modalInner.find("#subrace-group").hide();
		this._$modalInner.find("#race-details").hide();
		this._$modalInner.find(".race-card").removeClass("selected");
	}

	async _handleRaceChange (raceName, raceSource) {
		const $subraceGroup = this._$modalInner.find("#subrace-group");
		const $subraceSelect = this._$modalInner.find("#character-subrace");

		// Hide subrace initially
		$subraceGroup.hide();

		if (!raceName || !raceSource) return;

		try {
			const race = this._allRaces.find(r => r.name === raceName && r.source === raceSource);
			if (!race) return;

			// Check for subraces in the separate subraces array
			const availableSubraces = this._allSubraces.filter(subrace =>
				subrace.raceName === raceName && subrace.raceSource === raceSource
			);

			if (availableSubraces.length > 0) {
				// Show subrace selection
				$subraceSelect.html('<option value="">Select a subrace...</option>');

				availableSubraces.forEach(subrace => {
					$subraceSelect.append(`<option value="${subrace.name}">${subrace.name}</option>`);
				});

				$subraceGroup.show();
			}

		} catch (error) {
			console.error("Failed to handle race change:", error);
		}
	}

	async _handleSubraceChange () {
		if (!this._selectedRace) return;

		const subraceValue = this._$modalInner.find("#character-subrace").val();
		const race = this._selectedRace.race;

		// If subrace is selected, update the display to show subrace details
		if (subraceValue) {
			// Find the subrace in the separate subraces array
			const subrace = this._allSubraces.find(sr =>
				sr.name === subraceValue &&
				sr.raceName === this._selectedRace.name &&
				sr.raceSource === this._selectedRace.source
			);

			if (subrace) {
				// Create a merged race+subrace object for display
				const mergedRace = Renderer.race._getMergedSubrace(race, MiscUtil.copyFast(subrace));
				this._displayRaceDetails(mergedRace);
			}
		} else {
			// Show base race details
			this._displayRaceDetails(race);
		}
	}

	/**
	 * Renders the class selection step
	 * @private
	 */
	_renderClassSelectionStep () {
		return `
			<div class="ve-flex-col">
				<div class="form-group">
					<label class="ve-flex-v-center">
						<span>Choose Your Class</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<div class="invalid-feedback" id="class-error"></div>
					<small class="form-text text-muted">Browse classes below and click to select. Use the search to filter results.</small>
				</div>

				<div class="form-group">
					<input
						type="text"
						class="form-control"
						id="class-search"
						placeholder="Search classes by name..."
						autocomplete="off"
					>
				</div>



				<div class="ve-flex">
					<div class="ve-col-4 pr-2">
						<div id="class-list-container" class="race-list-container">
							<div id="class-list" class="race-list">
								<div class="text-center p-3">
									<div class="spinner-border" role="status">
										<span class="sr-only">Loading classes...</span>
									</div>
									<div class="mt-2">Loading classes...</div>
								</div>
							</div>
						</div>
					</div>
					<div class="ve-col-8 pl-2">
						<div id="class-details" class="race-details" style="display: none;">
							<div class="alert alert-info">
								<strong>Class Details</strong>
								<p class="mb-0">Select a class from the list to view detailed information here.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Validates class selection
	 * @private
	 */
	async _validateClassSelection () {
		// Clear previous errors
		this._$modalInner.find(".form-control").removeClass("is-invalid is-valid");
		this._$modalInner.find(".invalid-feedback").text("");

		let isValid = true;

		// Validate class selection
		if (!this._selectedClass) {
			this._$modalInner.find("#class-search").addClass("is-invalid");
			this._$modalInner.find("#class-error").text("Class selection is required");
			isValid = false;
		} else {
			this._$modalInner.find("#class-search").addClass("is-valid");
		}

		// Apply class to character if valid
		if (isValid && this._selectedClass) {
			try {
				// Apply class using CharacterClassUtil
				this._characterData = await CharacterClassUtil.pApplyClassToCharacter(
					this._characterData,
					this._selectedClass.name,
					this._selectedClass.source,
					this._selectedClass.subclass || null
				);
			} catch (error) {
				console.error("Failed to apply class to character:", error);
				this._$modalInner.find("#class-search").addClass("is-invalid");
				this._$modalInner.find("#class-error").text("Failed to apply class features");
				isValid = false;
			}
		}

		return isValid;
	}

	/**
	 * Initializes class selection interface using the statgen UI patterns
	 * @private
	 */
	async _initializeClassSelection () {
		console.log("=====================================");
		console.log("INITIALIZING CLASS SELECTION - START");
		console.log("=====================================");

		// Add a visible indicator to the page
		document.title = "CLASS SELECTION INITIALIZING - 5etools";

		try {
			console.log("Initializing class selection...");

			// Load all class data using DataUtil like the classes.html page
			console.log("About to call DataUtil.class.loadJSON()...");
			const classData = await DataUtil.class.loadJSON();
			console.log("DataUtil.class.loadJSON() returned:", classData);

			this._allClasses = classData.class || [];
			console.log("Classes loaded:", this._allClasses.length, "classes");

			if (this._allClasses.length === 0) {
				console.error("ERROR: No classes loaded from data!");
				return;
			}

			// Create a list prioritizing subclasses for selection
			this._allClassesFlattened = [];
			this._allSubclasses = [];

			this._allClasses.forEach(cls => {
				console.log("Processing class:", cls.name, "source:", cls.source, "isSidekick:", cls.isSidekick);

				// Skip sidekicks as they're not meant for regular character creation
				if (cls.isSidekick === true || cls.name === "Sidekick" || cls.source === "UA2019SidekicksUA" || cls.isHomebrew) {
					console.log("SKIPPING:", cls.name, "- filtered out");
					return;
				}

				console.log("ADDING base class:", cls.name);
				// Add the base class first
				this._allClassesFlattened.push({
					...cls,
					_isSubclass: false,
					displayName: cls.name
				});

				// Then add each subclass as a separate selectable entry
				if (cls.subclasses && cls.subclasses.length > 0) {
					console.log("Found", cls.subclasses.length, "subclasses for", cls.name);
					cls.subclasses.forEach(subclass => {
						console.log("ADDING subclass:", `${cls.name} (${subclass.name})`);
						// Create a flattened subclass entry for selection
						const flattenedSubclass = {
							...subclass,
							name: `${cls.name} (${subclass.name})`,
							source: subclass.source || cls.source,
							_isSubclass: true,
							_parentClassName: cls.name,
							_parentClassSource: cls.source,
							_subclassName: subclass.name,
							_parentClass: cls,
							_fullSubclass: subclass, // Store the complete subclass object
							displayName: `${cls.name} (${subclass.name})`,
							// Copy important class properties to subclass
							hd: cls.hd,
							primaryAbility: cls.primaryAbility,
							proficiency: cls.proficiency,
							spellcastingAbility: cls.spellcastingAbility,
							casterProgression: cls.casterProgression
						};
						this._allClassesFlattened.push(flattenedSubclass);
						this._allSubclasses.push(flattenedSubclass);
					});
				} else {
					console.log("No subclasses found for", cls.name);
				}
			});

			console.log("Flattened classes:", this._allClassesFlattened.length, "total entries");

			// Set up event handlers
			const $classSearch = this._$modalInner.find("#class-search");
			// Restore previous search value
			$classSearch.val(this._searchStates.classSearch);
			$classSearch.off("input").on("input", (e) => {
				this._searchStates.classSearch = $(e.target).val();
				this._handleClassSearch();
			});

			// Load and display classes
			await this._loadAndDisplayClasses();

		} catch (error) {
			console.error("Failed to initialize class selection:", error);
			const $classList = this._$modalInner.find("#class-list");
			$classList.html(`
				<div class="text-center p-3 text-danger">
					<div class="mb-2">Failed to load classes</div>
					<div class="small">Please refresh and try again</div>
				</div>
			`);
		}
	}

	async _loadAndDisplayClasses () {
		const $classList = this._$modalInner.find("#class-list");

		if (!this._allClassesFlattened || this._allClassesFlattened.length === 0) {
			$classList.html(`
				<div class="text-center p-3">
					<div class="mb-2">No classes found</div>
					<div class="small text-muted">Check your data files</div>
				</div>
			`);
			return;
		}

		// Sort classes by name
		const sortedClasses = [...this._allClassesFlattened].sort((a, b) => a.name.localeCompare(b.name));

		// Generate class cards
		const classCardsHtml = sortedClasses.map(cls => this._generateClassCard(cls)).join('');

		$classList.html(classCardsHtml);

		// Add click handlers to class cards
		$classList.find('.class-card').off('click').on('click', (e) => {
			const classValue = $(e.currentTarget).data('class-value');
			this._selectClassFromCard(classValue);
		});

		// Restore previously selected class if returning to this step
		if (this._selectedClass && this._selectedClass.value) {
			this._selectClassFromCard(this._selectedClass.value);
		}
		// Auto-select the first class only if no class is already selected
		else if (sortedClasses.length > 0) {
			const firstClass = sortedClasses[0];
			const firstClassValue = `${firstClass.name}|${firstClass.source}`;
			this._selectClassFromCard(firstClassValue);
		}
	}

	_generateClassCard (cls) {
		const source = Parser.sourceJsonToAbv(cls.source);
		const hitDie = cls.hd?.faces || cls._parentClass?.hd?.faces || "?";

		// Get primary abilities
		let primaryAbilities = "None";
		if (cls.primaryAbility || cls._parentClass?.primaryAbility) {
			const abilities = cls.primaryAbility || cls._parentClass.primaryAbility;
			if (Array.isArray(abilities) && abilities.length > 0) {
				primaryAbilities = abilities.map(ab => ab.toUpperCase()).join(", ");
			}
		}

		// Get saving throws
		let savingThrows = "None";
		if (cls.proficiency || cls._parentClass?.proficiency) {
			const profs = cls.proficiency || cls._parentClass.proficiency;
			if (Array.isArray(profs) && profs.length > 0) {
				savingThrows = profs.map(prof => prof.toUpperCase()).join(", ");
			}
		}

		// Check if this is a subclass
		const isSubclass = cls._isSubclass;
		const displayName = cls.name;

		return `
			<div class="class-card" data-class-value="${cls.name}|${cls.source}">
				<div class="class-card-header">
					<div class="class-card-name">${displayName}</div>
					<div class="class-card-source">${source}</div>
				</div>
				<div class="class-card-details">
					<div class="class-card-detail"><strong>Hit Die:</strong> d${hitDie}</div>
					<div class="class-card-detail"><strong>Saves:</strong> ${savingThrows}</div>
				</div>
				<div class="class-card-primary">${primaryAbilities}</div>
				<div class="class-card-type">
					${isSubclass ? 'Subclass' : 'Base Class'}
				</div>
			</div>
		`;
	}

	_handleClassSearch () {
		const searchTerm = this._$modalInner.find("#class-search").val().toLowerCase().trim();
		const $classCards = this._$modalInner.find(".class-card");
		let firstVisibleClass = null;

		$classCards.each((i, card) => {
			const $card = $(card);
			const className = $card.find(".class-card-name").text().toLowerCase();
			const classSource = $card.find(".class-card-source").text().toLowerCase();

			if (!searchTerm || className.includes(searchTerm) || classSource.includes(searchTerm)) {
				$card.show();
				if (!firstVisibleClass) {
					firstVisibleClass = $card.data('class-value');
				}
			} else {
				$card.hide();
			}
		});

		// Auto-select the first visible class after search
			if (firstVisibleClass) {
				this._selectClassFromCard(firstVisibleClass);
			}
	}



	async _displayClassDetails (cls) {
		const $classDetails = this._$modalInner.find("#class-details");

		try {
			console.log("Displaying class details for:", cls.name, "isSubclass:", cls._isSubclass);

			// Check if this is a subclass selection - PRIORITY ROUTE
			if (cls._isSubclass && cls._fullSubclass && cls._parentClass) {
				// Display detailed subclass information using the stored references
				console.log("Route 1: Displaying stored subclass details for:", cls._subclassName, "from", cls._parentClassName);
				await this._displayDetailedSubclass(cls._parentClass, cls._fullSubclass);
				return;
			}

			// If this is a subclass but we don't have the full data stored, load it
			if (cls._isSubclass && cls._subclassName && cls._parentClassName) {
				console.log("Route 2: Loading subclass data for:", cls._subclassName, "from", cls._parentClassName);
				try {
					// Load the complete class data with proper subclass features
					const allClassData = await DataUtil.class.loadJSON();
					const fullClassData = allClassData.class.find(c => c.name === cls._parentClassName && c.source === cls._parentClassSource);
					if (fullClassData) {
						// Find the specific subclass
						const selectedSubclass = fullClassData.subclasses?.find(sc =>
							sc.name === cls._subclassName && (sc.source === cls.source || sc.source === cls._parentClassSource)
						);
						if (selectedSubclass) {
							// Call the detailed subclass display method
							console.log("Found subclass data, displaying details for:", selectedSubclass.name);
							await this._displayDetailedSubclass(fullClassData, selectedSubclass);
							return;
						} else {
							console.warn("Could not find subclass in parent class data:", cls._subclassName);
						}
					} else {
						console.warn("Could not find parent class data:", cls._parentClassName);
					}
				} catch (err) {
					console.warn("Failed to load detailed subclass data:", err);
				}
			}

			// Use the same approach as the classes.html page for base classes
			const classToRender = cls._isSubclass ? cls._parentClass : cls;

			// Display base class information with subclass selector
			if (!cls._isSubclass && cls.subclasses && cls.subclasses.length > 0) {
				// This is a base class with subclasses - show class info and subclass options
				console.log("Route 3: Displaying base class with subclass options for:", cls.name);
				await this._displayClassWithSubclassOptions(cls);
				return;
			}

			console.log("Route 4: Displaying basic class information for:", classToRender.name);

			// Get class fluff (descriptive text) using the proper 5etools method
			let renderedContent = '';

			try {
				// Get the fluff data for the class
				const clsFluff = await Renderer.class.pGetFluff(classToRender);

				if (clsFluff && clsFluff.entries) {
					// Render the class description using the standard renderer
					const renderer = Renderer.get().setFirstSection(true);

					// Render the class name and basic info
					renderedContent += `<div class="ve-flex-col">`;
					renderedContent += `<div class="split-v-center mb-2">`;
					renderedContent += `<h4 class="m-0">${classToRender.name}${cls._isSubclass ? ` (${cls._subclassName})` : ''}</h4>`;
					renderedContent += `<small class="text-muted">Source: ${Parser.sourceJsonToAbv(classToRender.source)}</small>`;
					renderedContent += `</div>`;

					// Add basic class stats
					const hitDie = classToRender.hd?.faces || "?";
					let primaryAbilities = "None";
					if (classToRender.primaryAbility) {
						if (Array.isArray(classToRender.primaryAbility) && classToRender.primaryAbility.length > 0) {
							primaryAbilities = classToRender.primaryAbility.map(ability => {
								if (typeof ability === 'string') return ability.toUpperCase();
								if (ability.choose && ability.choose.from) {
									return `Choose from: ${ability.choose.from.join(', ').toUpperCase()}`;
								}
								return 'Unknown';
							}).join(' or ');
						}
					}

					// If this is a fallback subclass display (shouldn't happen with our new logic)
					if (cls._isSubclass && cls._subclassName) {
						renderedContent += `<div class="alert alert-warning mb-3">`;
						renderedContent += `<h5><span class="glyphicon glyphicon-warning-sign"></span> Limited Information</h5>`;
						renderedContent += `<p>Showing basic information for ${cls._subclassName} subclass. Detailed features may not be available.</p>`;
						renderedContent += `</div>`;
					}

					// Then show the main class information
					if (clsFluff.entries && clsFluff.entries.length > 0) {
						renderedContent += `<h5>About the ${classToRender.name} Class</h5>`;
						renderedContent += `<div class="cls-fluff">`;

						// Render each entry in the fluff
						clsFluff.entries.forEach(entry => {
							if (typeof entry === 'string') {
								renderedContent += `<p>${entry}</p>`;
							} else if (entry.type === 'section' && entry.entries) {
								renderedContent += `<div class="mb-3">`;
								if (entry.name && entry.name !== classToRender.name) {
									renderedContent += `<h6>${entry.name}</h6>`;
								}
								entry.entries.forEach(subEntry => {
									renderedContent += renderer.render(subEntry);
								});
								renderedContent += `</div>`;
							} else {
								renderedContent += renderer.render(entry);
							}
						});

						renderedContent += `</div>`;
					}

					renderedContent += `</div>`;
				} else {
					// Fallback if no fluff is available
					throw new Error("No class fluff available");
				}
			} catch (fluffError) {
				console.warn("Failed to get class fluff, using fallback:", fluffError);
				// Use the manual HTML generation as fallback
				renderedContent = this._generateClassDetailsHTML(classToRender, cls);
			}

			$classDetails.html(`
				<div class="race-details-content">
					${renderedContent}
				</div>
			`);

			$classDetails.show();
		} catch (error) {
			console.warn("Failed to render class details:", error);
			$classDetails.html(`
				<div class="alert alert-warning">
					<strong>${cls._isSubclass ? cls._parentClassName : cls.name}</strong>
					<p class="mb-0">Details not available</p>
				</div>
			`);
			$classDetails.show();
		}
	}

	_generateClassDetailsHTML(classToRender, selectedEntry) {
		const className = selectedEntry._isSubclass ? selectedEntry._parentClassName : classToRender.name;
		const subclassName = selectedEntry._isSubclass ? selectedEntry._subclassName : null;
		const source = Parser.sourceJsonToAbv(classToRender.source);
		const hitDie = classToRender.hd?.faces || "?";

		// Get primary abilities
		let primaryAbilities = "None";
		if (classToRender.primaryAbility) {
			if (Array.isArray(classToRender.primaryAbility) && classToRender.primaryAbility.length > 0) {
				primaryAbilities = classToRender.primaryAbility.map(ability => {
					if (typeof ability === 'string') return ability.toUpperCase();
					if (ability.choose && ability.choose.from) {
						return `Choose from: ${ability.choose.from.join(', ').toUpperCase()}`;
					}
					return 'Unknown';
				}).join(' or ');
			}
		}

		// Get proficiencies
		let proficiencies = [];
		if (classToRender.startingProficiencies) {
			if (classToRender.startingProficiencies.armor) {
				proficiencies.push(`<strong>Armor:</strong> ${classToRender.startingProficiencies.armor.join(', ')}`);
			}
			if (classToRender.startingProficiencies.weapons) {
				proficiencies.push(`<strong>Weapons:</strong> ${classToRender.startingProficiencies.weapons.join(', ')}`);
			}
			if (classToRender.startingProficiencies.tools) {
				proficiencies.push(`<strong>Tools:</strong> ${classToRender.startingProficiencies.tools.join(', ')}`);
			}
		}

		return `
			<div class="class-summary">
				<h4>${className}${subclassName ? ` (${subclassName})` : ''}</h4>
				<p class="mb-2"><small class="text-muted">Source: ${source}</small></p>

				<div class="mb-3">
					<strong>Hit Die:</strong> d${hitDie}<br>
					<strong>Primary Abilities:</strong> ${primaryAbilities}
				</div>

				${proficiencies.length > 0 ? `
					<div class="mb-3">
						<strong>Proficiencies:</strong><br>
						${proficiencies.join('<br>')}
					</div>
				` : ''}

				${classToRender.fluff && classToRender.fluff[0] && classToRender.fluff[0].entries ? `
					<div class="mb-3">
						<strong>Description:</strong>
						<p class="small">${classToRender.fluff[0].entries[0] || 'No description available.'}</p>
					</div>
				` : ''}
			</div>
		`;
	}

	/**
	 * Display detailed subclass features with level progression (using properly loaded class data)
	 * @private
	 */
	async _displayDetailedSubclass(classData, subclass) {
		const $classDetails = this._$modalInner.find("#class-details");

		try {
			console.log("Displaying detailed subclass:", subclass.name, "for class:", classData.name);

			let html = `<div class="character-creator__detailed-subclass">`;

			// Header with subclass name and source
			html += `<div class="split-v-center mb-3">`;
			html += `<h4 class="m-0">${subclass.name}</h4>`;
			html += `<small class="text-muted">Source: ${Parser.sourceJsonToAbv(subclass.source)}</small>`;
			html += `</div>`;

			html += `<div class="alert alert-info mb-3">`;
			html += `<h5 class="mb-2"><span class="glyphicon glyphicon-star"></span> ${classData.name} Subclass</h5>`;
			html += `<p>This is a specialized path for the ${classData.name} class.</p>`;
			html += `</div>`;

			// Get and display subclass fluff (description)
			try {
				const subclassFluff = await Renderer.subclass.pGetFluff(subclass);

				if (subclassFluff && subclassFluff.entries && subclassFluff.entries.length > 0) {
					html += `<div class="mb-4">`;
					html += `<h5>About the ${subclass.name}</h5>`;

					const renderer = Renderer.get().setFirstSection(true);
					subclassFluff.entries.forEach(entry => {
						if (typeof entry === 'string') {
							html += `<p>${entry}</p>`;
						} else if (entry.type === 'section' && entry.entries) {
							if (entry.name && entry.name !== subclass.name) {
								html += `<h6>${entry.name}</h6>`;
							}
							entry.entries.forEach(subEntry => {
								html += renderer.render(subEntry);
							});
						} else {
							html += renderer.render(entry);
						}
					});

					html += `</div>`;
				}
			} catch (fluffError) {
				console.warn("Could not load subclass fluff:", fluffError);
			}

			// Display subclass features by level - THIS IS THE KEY PART
			if (subclass.subclassFeatures && subclass.subclassFeatures.length > 0) {
				html += `<div class="mb-4">`;
				html += `<h5>${subclass.name} Features by Level</h5>`;

				console.log("Subclass features found:", subclass.subclassFeatures.length, "levels");

				const renderer = Renderer.get().setFirstSection(true);

				// Process each level of subclass features
				for (let levelIndex = 0; levelIndex < subclass.subclassFeatures.length; levelIndex++) {
					const levelFeatures = subclass.subclassFeatures[levelIndex];
					if (!levelFeatures || levelFeatures.length === 0) continue;

					// Get the level from the first feature
					const level = levelFeatures[0].level || (levelIndex + 1) * 3; // Subclasses typically get features at levels 3, 6, 10, 14

					html += `<div class="subclass-level-block mb-4 p-3" style="border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">`;
					html += `<h6 class="subclass-level-header mb-3" style="color: #337ab7; border-bottom: 1px solid #ddd; padding-bottom: 8px; font-weight: bold;">Level ${level}</h6>`;

					// Process each feature at this level
					for (const feature of levelFeatures) {
						if (!feature.name) continue;

						html += `<div class="subclass-feature mb-3" style="border-left: 3px solid #337ab7; padding-left: 12px;">`;
						html += `<h6 class="feature-name mb-2" style="color: #333; font-weight: bold;">${feature.name}</h6>`;

						// Render feature description
						if (feature.entries && feature.entries.length > 0) {
							feature.entries.forEach(entry => {
								try {
									html += renderer.render(entry);
								} catch (renderError) {
									console.warn("Error rendering feature entry:", renderError);
									if (typeof entry === 'string') {
										html += `<p>${entry}</p>`;
									} else if (entry.type === 'list' && entry.items) {
										html += `<ul>`;
										entry.items.forEach(item => {
											if (typeof item === 'string') {
												html += `<li>${item}</li>`;
											} else {
												html += `<li>${renderer.render(item)}</li>`;
											}
										});
										html += `</ul>`;
									}
								}
							});
						}

						html += `</div>`;
					}

					html += `</div>`;
				}

				html += `</div>`;
			} else {
				console.warn("No subclass features found for:", subclass.name);
				html += `<div class="alert alert-warning mb-3">`;
				html += `<h6>No Features Available</h6>`;
				html += `<p>Detailed features for this subclass are not available in the current data.</p>`;
				html += `</div>`;
			}

			// Show additional spells if available
			if (subclass.additionalSpells && subclass.additionalSpells.length > 0) {
				html += `<div class="mb-4">`;
				html += `<h5>Additional Spells</h5>`;

				subclass.additionalSpells.forEach(spellList => {
					if (spellList.spells) {
						Object.keys(spellList.spells).forEach(level => {
							const spells = spellList.spells[level];
							if (spells && spells.length > 0) {
								html += `<p><strong>Level ${level}:</strong> `;
								const spellNames = spells.map(spell => {
									if (typeof spell === 'string') return spell;
									if (spell.name) return spell.name;
									return 'Unknown Spell';
								});
								html += spellNames.join(', ');
								html += `</p>`;
							}
						});
					}
				});

				html += `</div>`;
			}

			// Show basic class information at the bottom for context
			html += `<hr class="hr-2">`;
			html += `<h5>Base ${classData.name} Class Stats</h5>`;
			html += `<div class="row">`;
			html += `<div class="col-md-6">`;
			html += `<p><strong>Hit Die:</strong> d${classData.hd?.faces || "?"}</p>`;
			if (classData.primaryAbility) {
				const abilities = Array.isArray(classData.primaryAbility) ?
					classData.primaryAbility.map(ab => {
						if (typeof ab === 'string') return ab.toUpperCase();
						if (ab.choose && ab.choose.from) {
							return `Choose from: ${ab.choose.from.join(', ').toUpperCase()}`;
						}
						return ab.toString().toUpperCase();
					}).join(" or ") :
					classData.primaryAbility.toString().toUpperCase();
				html += `<p><strong>Primary Abilities:</strong> ${abilities}</p>`;
			}
			if (classData.proficiency) {
				const saves = Array.isArray(classData.proficiency) ?
					classData.proficiency.join(", ").toUpperCase() :
					classData.proficiency.toString().toUpperCase();
				html += `<p><strong>Saving Throws:</strong> ${saves}</p>`;
			}
			html += `</div>`;
			html += `<div class="col-md-6">`;
			if (classData.startingProficiencies?.armor) {
				const armor = Array.isArray(classData.startingProficiencies.armor) ?
					classData.startingProficiencies.armor.join(", ") :
					classData.startingProficiencies.armor.toString();
				html += `<p><strong>Armor:</strong> ${armor}</p>`;
			}
			if (classData.startingProficiencies?.weapons) {
				const weapons = Array.isArray(classData.startingProficiencies.weapons) ?
					classData.startingProficiencies.weapons.join(", ") :
					classData.startingProficiencies.weapons.toString();
				html += `<p><strong>Weapons:</strong> ${weapons}</p>`;
			}
			html += `</div>`;
			html += `</div>`;

			html += `</div>`;

			$classDetails.html(`<div class="race-details-content">${html}</div>`);
			$classDetails.show();

			console.log("Successfully displayed detailed subclass information");

		} catch (e) {
			console.error("Error displaying detailed subclass:", e);
			$classDetails.html(`
				<div class="alert alert-danger">
					<h4>Error Loading Subclass Details</h4>
					<p>Unable to load detailed information for ${subclass.name}: ${e.message}</p>
					<p class="small">Check the browser console for more details.</p>
				</div>
			`);
			$classDetails.show();
		}
	}

	/**
	 * Renders the subclass selection step
	 * @private
	 */
	_renderSubclassSelectionStep () {
		return `
			<div class="character-creator__step">
				<div class="row">
					<div class="col-md-8">
						<h3>Choose Your Subclass</h3>
						<p class="text-muted mb-3">Select a subclass specialization for your ${this._selectedClass ? this._selectedClass.name : 'selected class'}.</p>

						<div class="form-group">
							<label for="subclass-search" class="form-label">Search Subclasses</label>
							<input type="text" class="form-control" id="subclass-search" placeholder="Search for a subclass...">
							<div class="invalid-feedback" id="subclass-error"></div>
						</div>

						<div id="subclass-list" class="character-creator__list">
							<!-- Subclass list will be populated here -->
						</div>
					</div>
					<div class="col-md-4">
						<div id="subclass-details" class="race-details" style="display: none;">
							<div class="alert alert-info">
								<strong>Subclass Details</strong>
								<p class="mb-0">Select a subclass from the list to view detailed information here.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Validates subclass selection
	 * @private
	 */
	async _validateSubclassSelection () {
		// Clear previous errors
		this._$modalInner.find(".form-control").removeClass("is-invalid is-valid");
		this._$modalInner.find(".invalid-feedback").text("");

		let isValid = true;

		// Validate subclass selection
		if (!this._selectedSubclass) {
			this._$modalInner.find("#subclass-search").addClass("is-invalid");
			this._$modalInner.find("#subclass-error").text("Subclass selection is required");
			isValid = false;
		} else {
			this._$modalInner.find("#subclass-search").addClass("is-valid");
		}

		// Apply subclass to character if valid
		if (isValid && this._selectedSubclass) {
			try {
				// Store the subclass selection in character data
				this._characterData.class = this._characterData.class || {};
				this._characterData.class.subclass = {
					name: this._selectedSubclass.name,
					source: this._selectedSubclass.source,
					features: this._selectedSubclass.subclassFeatures || []
				};
				console.log("Applied subclass to character:", this._selectedSubclass.name);
			} catch (error) {
				console.error("Failed to apply subclass to character:", error);
				this._$modalInner.find("#subclass-search").addClass("is-invalid");
				this._$modalInner.find("#subclass-error").text("Failed to apply subclass features");
				isValid = false;
			}
		}

		return isValid;
	}

	/**
	 * Initializes subclass selection interface
	 * @private
	 */
	async _initializeSubclassSelection () {
		console.log("=====================================");
		console.log("INITIALIZING SUBCLASS SELECTION - START");
		console.log("=====================================");

		document.title = "SUBCLASS SELECTION INITIALIZING - 5etools";

		try {
			console.log("Initializing subclass selection for class:", this._selectedClass?.name);

			if (!this._selectedClass) {
				console.error("No class selected - cannot initialize subclass selection");
				return;
			}

			// Get subclasses for the selected class
			this._availableSubclasses = [];
			if (this._selectedClass.subclasses && this._selectedClass.subclasses.length > 0) {
				this._availableSubclasses = this._selectedClass.subclasses;
				console.log("Found", this._availableSubclasses.length, "subclasses for", this._selectedClass.name);
			} else {
				console.log("No subclasses found for", this._selectedClass.name);
			}

			// Setup search functionality
			this._setupSubclassSearch();

			// Load and display subclasses
			await this._loadAndDisplaySubclasses();

			console.log("Subclass selection initialization complete");

		} catch (error) {
			console.error("Failed to initialize subclass selection:", error);
			const $subclassList = this._$modalInner.find("#subclass-list");
			$subclassList.html(`
				<div class="text-center p-3 text-danger">
					<div class="mb-2">Failed to load subclasses</div>
					<div class="small">Please refresh and try again</div>
				</div>
			`);
		}
	}

	/**
	 * Sets up subclass search functionality
	 * @private
	 */
	_setupSubclassSearch () {
		const $search = this._$modalInner.find("#subclass-search");

		$search.off("input").on("input", (e) => {
			const query = e.target.value.toLowerCase();
			this._filterSubclasses(query);
		});

		// Restore previous search state
		if (this._searchStates.subclassSearch) {
			$search.val(this._searchStates.subclassSearch);
		}
	}

	/**
	 * Filters visible subclasses based on search query
	 * @private
	 */
	_filterSubclasses (query) {
		this._searchStates.subclassSearch = query;

		const $items = this._$modalInner.find("#subclass-list .character-creator__list-item");

		$items.each((i, item) => {
			const $item = $(item);
			const text = $item.text().toLowerCase();

			if (text.includes(query)) {
				$item.show();
			} else {
				$item.hide();
			}
		});
	}

	/**
	 * Loads and displays available subclasses
	 * @private
	 */
	async _loadAndDisplaySubclasses () {
		const $subclassList = this._$modalInner.find("#subclass-list");

		if (!this._availableSubclasses || this._availableSubclasses.length === 0) {
			$subclassList.html(`
				<div class="text-center p-3">
					<div class="mb-2">No subclasses available</div>
					<div class="small text-muted">This class does not have subclasses, or they may not be loaded.</div>
				</div>
			`);
			return;
		}

		let html = '';

		this._availableSubclasses.forEach((subclass, index) => {
			const isSelected = this._selectedSubclass && this._selectedSubclass.name === subclass.name;

			html += `
				<div class="character-creator__list-item ${isSelected ? 'active' : ''}" data-subclass-index="${index}">
					<div class="split-v-center">
						<div>
							<div class="h6 mb-1">${subclass.name}</div>
							<div class="small text-muted">
								${Parser.sourceJsonToAbv(subclass.source)}
								${subclass.shortName ? ` • ${subclass.shortName}` : ''}
							</div>
						</div>
						<div class="text-right">
							<button class="ve-btn ve-btn-xs ve-btn-default" data-subclass-index="${index}">
								View Details
							</button>
						</div>
					</div>
				</div>
			`;
		});

		$subclassList.html(html);

		// Add click handlers
		$subclassList.find(".character-creator__list-item").off("click").on("click", (e) => {
			const index = parseInt($(e.currentTarget).data("subclass-index"));
			this._selectSubclass(index);
		});

		$subclassList.find("button[data-subclass-index]").off("click").on("click", (e) => {
			e.stopPropagation();
			const index = parseInt($(e.currentTarget).data("subclass-index"));
			this._displaySubclassDetails(index);
		});

		// Apply any existing search filter
		if (this._searchStates.subclassSearch) {
			this._filterSubclasses(this._searchStates.subclassSearch);
		}
	}

	/**
	 * Selects a subclass
	 * @private
	 */
	_selectSubclass (index) {
		if (index >= 0 && index < this._availableSubclasses.length) {
			this._selectedSubclass = this._availableSubclasses[index];

			// Update UI
			this._$modalInner.find(".character-creator__list-item").removeClass("active");
			this._$modalInner.find(`[data-subclass-index="${index}"]`).addClass("active");

			// Update search input
			this._$modalInner.find("#subclass-search").val(this._selectedSubclass.name);

			console.log("Selected subclass:", this._selectedSubclass.name);

			// Display details automatically when selected
			this._displaySubclassDetails(index);
		}
	}

	/**
	 * Displays detailed information about a subclass
	 * @private
	 */
	async _displaySubclassDetails (index) {
		const subclass = this._availableSubclasses[index];
		if (!subclass) return;

		console.log("Displaying details for subclass:", subclass.name);

		const $subclassDetails = this._$modalInner.find("#subclass-details");

		try {
			let html = `<div class="character-creator__detailed-subclass">`;

			// Header with subclass name and source
			html += `<div class="split-v-center mb-3">`;
			html += `<h4 class="m-0">${subclass.name}</h4>`;
			html += `<small class="text-muted">Source: ${Parser.sourceJsonToAbv(subclass.source)}</small>`;
			html += `</div>`;

			// Short description if available
			if (subclass.shortName || subclass.fluff) {
				html += `<div class="alert alert-info mb-3">`;
				html += `<h5 class="mb-2"><span class="glyphicon glyphicon-star"></span> ${this._selectedClass.name} Subclass</h5>`;
				if (subclass.shortName) {
					html += `<p><strong>${subclass.shortName}</strong></p>`;
				}
				html += `</div>`;
			}

			// Display subclass features by level
			if (subclass.subclassFeatures && subclass.subclassFeatures.length > 0) {
				html += `<div class="mb-4">`;
				html += `<h5>${subclass.name} Features by Level</h5>`;

				const renderer = Renderer.get().setFirstSection(true);

				// Process each level of subclass features
				for (let levelIndex = 0; levelIndex < subclass.subclassFeatures.length; levelIndex++) {
					const levelFeatures = subclass.subclassFeatures[levelIndex];
					if (!levelFeatures || levelFeatures.length === 0) continue;

					// Calculate the actual level (subclass features typically start at level 3)
					const actualLevel = (levelIndex * 3) + 3; // Most subclasses start at 3rd level

					html += `<div class="mb-3">`;
					html += `<h6 class="mb-2">Level ${actualLevel}</h6>`;

					levelFeatures.forEach(featureRef => {
						try {
							// Feature references are usually strings like "Feature Name|Class|Source|Level"
							const parts = featureRef.split('|');
							const featureName = parts[0];

							html += `<div class="mb-2">`;
							html += `<strong>${featureName}</strong>`;
							html += `</div>`;
						} catch (renderError) {
							console.warn("Error processing feature reference:", renderError);
							if (typeof featureRef === 'string') {
								html += `<p>${featureRef}</p>`;
							}
						}
					});

					html += `</div>`;
				}

				html += `</div>`;
			} else {
				html += `<div class="alert alert-warning mb-3">`;
				html += `<p>Detailed features for this subclass are not available in the current data.</p>`;
				html += `</div>`;
			}

			html += `</div>`;

			$subclassDetails.html(`<div class="race-details-content">${html}</div>`);
			$subclassDetails.show();

			console.log("Successfully displayed subclass details for:", subclass.name);

		} catch (e) {
			console.error("Error displaying subclass details:", e);
			$subclassDetails.html(`
				<div class="alert alert-danger">
					<h4>Error Loading Subclass Details</h4>
					<p>Unable to load detailed information for ${subclass.name}: ${e.message}</p>
					<p class="small">Check the browser console for more details.</p>
				</div>
			`);
			$subclassDetails.show();
		}
	}

	async _displayClassWithSubclassOptions (cls) {
		const $classDetails = this._$modalInner.find("#class-details");

		try {
			const renderer = Renderer.get().setFirstSection(true);
			let renderedContent = '';

			// Header
			renderedContent += `<div class="ve-flex-col">`;
			renderedContent += `<div class="split-v-center mb-3">`;
			renderedContent += `<h4 class="m-0">${cls.name}</h4>`;
			renderedContent += `<small class="text-muted">Source: ${Parser.sourceJsonToAbv(cls.source)}</small>`;
			renderedContent += `</div>`;

			// Basic class info
			const hitDie = cls.hd?.faces || "?";
			renderedContent += `<div class="mb-3">`;
			renderedContent += `<p><strong>Hit Die:</strong> d${hitDie}</p>`;
			if (cls.primaryAbility) {
				let primaryAbilities = "None";
				if (Array.isArray(cls.primaryAbility) && cls.primaryAbility.length > 0) {
					primaryAbilities = cls.primaryAbility.map(ability => {
						if (typeof ability === 'string') return ability.toUpperCase();
						if (ability.choose && ability.choose.from) {
							return `Choose from: ${ability.choose.from.join(', ').toUpperCase()}`;
						}
						return 'Unknown';
					}).join(' or ');
				}
				renderedContent += `<p><strong>Primary Ability:</strong> ${primaryAbilities}</p>`;
			}
			renderedContent += `</div>`;

			// Show class description
			try {
				const clsFluff = await Renderer.class.pGetFluff(cls);
				if (clsFluff && clsFluff.entries && clsFluff.entries.length > 0) {
					renderedContent += `<div class="mb-3">`;
					renderedContent += `<h5>About the ${cls.name} Class</h5>`;

					// Show first entry as description
					const firstEntry = clsFluff.entries[0];
					if (typeof firstEntry === 'string') {
						renderedContent += `<p>${firstEntry}</p>`;
					} else {
						renderedContent += renderer.render(firstEntry);
					}

					renderedContent += `</div>`;
				}
			} catch (fluffError) {
				console.warn("Could not load class fluff:", fluffError);
			}

			// Show subclass options
			if (cls.subclasses && cls.subclasses.length > 0) {
				renderedContent += `<div class="mb-3">`;
				renderedContent += `<h5>Available Subclasses</h5>`;
				renderedContent += `<p class="text-muted small">Click on a subclass to see its detailed features:</p>`;

				cls.subclasses.forEach(subclass => {
					renderedContent += `<div class="list-group-item list-group-item-action" style="cursor: pointer; margin-bottom: 5px;" `;
					renderedContent += `data-subclass-name="${subclass.name}" data-subclass-source="${subclass.source}">`;
					renderedContent += `<div class="ve-flex-v-center">`;
					renderedContent += `<div class="ve-flex-col">`;
					renderedContent += `<h6 class="mb-1">${subclass.name}</h6>`;
					if (subclass.source !== cls.source) {
						renderedContent += `<small class="text-muted">Source: ${Parser.sourceJsonToAbv(subclass.source)}</small>`;
					}
					renderedContent += `</div>`;
					renderedContent += `<span class="glyphicon glyphicon-chevron-right"></span>`;
					renderedContent += `</div>`;
					renderedContent += `</div>`;
				});

				renderedContent += `</div>`;
			}

			renderedContent += `</div>`;

			$classDetails.html(`
				<div class="race-details-content">
					${renderedContent}
				</div>
			`);

			// Add click handlers for subclass selection
			$classDetails.find('[data-subclass-name]').on('click', async (e) => {
				const $target = $(e.currentTarget);
				const subclassName = $target.data('subclass-name');
				const subclassSource = $target.data('subclass-source');

				// Find the subclass object
				const selectedSubclass = cls.subclasses.find(sc =>
					sc.name === subclassName && sc.source === subclassSource
				);

				if (selectedSubclass) {
					// Display detailed subclass information
					await this._displayDetailedSubclass(cls, selectedSubclass);
				}
			});

			$classDetails.show();

		} catch (error) {
			console.error("Error displaying class with subclass options:", error);
			$classDetails.html(`
				<div class="alert alert-danger">
					<strong>Error</strong>
					<p class="mb-0">Could not load class details</p>
				</div>
			`);
			$classDetails.show();
		}
	}

	/**
	 * Loads and displays available classes
	 * @private
	 */

	/**
	 * Handles class change and shows subclass options
	 * @private
	 */
	async _handleClassChange (className, classSource) {
		const $subclassGroup = this._$modalInner.find("#subclass-group");
		const $subclassSelect = this._$modalInner.find("#character-subclass");

		// Hide subclass initially
		$subclassGroup.hide();

		if (!className || !classSource) return;

		try {
			// Find subclasses in the loaded class data
			const selectedClass = this._allClasses.find(cls => cls.name === className && cls.source === classSource);
			if (selectedClass && selectedClass.subclasses && selectedClass.subclasses.length > 0) {
				// Show subclass selection
				$subclassSelect.html('<option value="">Select a subclass...</option>');

				selectedClass.subclasses.forEach(subclass => {
					$subclassSelect.append(`<option value="${subclass.name}">${subclass.name}</option>`);
				});

				$subclassGroup.show();
			}
		} catch (error) {
			console.error("Failed to handle class change:", error);
		}
	}

	/**
	 * Handles subclass change
	 * @private
	 */
	async _handleSubclassChange () {
		if (!this._selectedClass) return;

		const subclassValue = this._$modalInner.find("#character-subclass").val();

		if (subclassValue) {
			try {
				const classSummary = await CharacterClassUtil.pGetClassSummary(
					this._selectedClass.name,
					this._selectedClass.source,
					subclassValue
				);
				if (classSummary) {
					this._displayClassDetails(classSummary);
				}
			} catch (error) {
				console.error("Failed to handle subclass change:", error);
			}
		}
	}

	/**
	 * Clears class selection
	 * @private
	 */


	async _createCharacter () {
		try {
			// Show loading state
			const $nextBtn = this._$modalInner.find("#btn-next-step");
			const $cancelBtn = this._$modalInner.find("#btn-cancel");
			const $prevBtn = this._$modalInner.find("#btn-prev-step");

			$nextBtn.prop("disabled", true).text("Creating...");
			$cancelBtn.prop("disabled", true);
			$prevBtn.prop("disabled", true);

			// Validate character data one more time
			const validation = CharacterUtil.validateCharacter(this._characterData);
			if (!validation.isValid) {
				throw new Error(`Character validation failed: ${validation.errors.join(", ")}`);
			}

			// Create and save character
			const character = CharacterUtil.createNewCharacter(this._characterData);
			await CharacterStorageUtil.pAddCharacter(character);

			// Close modal
			this._doClose();

			// Refresh the page to show new character
			if (window.charactersPage) {
				await window.charactersPage.pOnLoad();
			}

			// Show success message
			JqueryUtil.doToast({
				content: `Character "${character.name}" created successfully!`,
				type: "success",
			});
		} catch (error) {
			// Restore button states
			const $nextBtn = this._$modalInner.find("#btn-next-step");
			const $cancelBtn = this._$modalInner.find("#btn-cancel");
			const $prevBtn = this._$modalInner.find("#btn-prev-step");

			$nextBtn.prop("disabled", false).text("Create Character");
			$cancelBtn.prop("disabled", false);
			$prevBtn.prop("disabled", false);

			// Show error message
			JqueryUtil.doToast({
				content: `Failed to create character: ${error.message}`,
				type: "danger",
			});
		}
	}

	async _selectClassFromCard(classValue) {
		if (!classValue) return;
		const [className, classSource] = classValue.split("|");
		let selectedEntry = this._allClassesFlattened.find(cls => cls.name === className && cls.source === classSource);
		if (!selectedEntry) return;
		if (selectedEntry._isSubclass) {
			this._selectedClass = {
				name: selectedEntry._parentClassName,
				source: selectedEntry._parentClassSource,
				subclass: selectedEntry._subclassName,
				value: classValue,
				class: selectedEntry._parentClass,
				displayName: className
			};
		} else {
			this._selectedClass = {
				name: className,
				source: classSource,
				subclass: null,
				value: classValue,
				class: selectedEntry,
				displayName: className
			};
		}
		this._$modalInner.find(".class-card").removeClass("selected");
		this._$modalInner.find(`.class-card[data-class-value='${classValue}']`).addClass("selected");
		const $classDetails = this._$modalInner.find("#class-details");
		try {
			const classForSummary = selectedEntry._isSubclass ? selectedEntry._parentClassName : className;
			const sourceForSummary = selectedEntry._isSubclass ? selectedEntry._parentClassSource : classSource;

			// Display the class details directly
			this._displayClassDetails(selectedEntry);
		} catch (error) {
			console.error("Failed to load class details:", error);
			$classDetails.html(`
				<div class="alert alert-warning">
					<h4>${className}</h4>
					<p>Unable to load detailed class information. Please try selecting another class.</p>
				</div>
			`);
		}
		$classDetails.show();
	}
}

// Patch SortUtil to handle missing caret elements gracefully
if (typeof SortUtil !== "undefined" && SortUtil._initBtnSortHandlers_showCaret) {
	const originalShowCaret = SortUtil._initBtnSortHandlers_showCaret;
	SortUtil._initBtnSortHandlers_showCaret = function({dispCaret, dispCarets, direction}) {
		try {
			// Check if dispCaret exists and has addClass method
			if (dispCaret && typeof dispCaret.addClass === "function") {
				return originalShowCaret.call(this, {dispCaret, dispCarets, direction});
			} else {
				// Silently skip if caret elements are not available
				return;
			}
		} catch (error) {
			// Log error but don't break the page (development only)
			// console.warn("Sort caret initialization failed:", error);
		}
	};
}

// Initialize the page
const charactersPage = new CharactersPage();
window.charactersPage = charactersPage; // Make it globally accessible for the character creator

// Initialize page with error handling
window.addEventListener("load", async () => {
	try {
		await charactersPage.pOnLoad();
	} catch (error) {
		// Log error but don't break the page (development only)
		// console.error("Failed to initialize characters page:", error);
	}
});

// Fallback button initialization - ensure the button works even if page init fails
window.addEventListener("DOMContentLoaded", () => {
	// Wait a bit for other scripts to load
	setTimeout(() => {
		const addCharacterBtn = document.getElementById("btn-add-character");
		if (addCharacterBtn) {
			// Remove any existing listeners
			const newBtn = addCharacterBtn.cloneNode(true);
			addCharacterBtn.parentNode.replaceChild(newBtn, addCharacterBtn);

			// Add our listener
			newBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();

				// console.log("Fallback button handler triggered");

				try {
					if (window.charactersPage && window.charactersPage._pHandleAddCharacter) {
						await window.charactersPage._pHandleAddCharacter();
					} else {
						// Direct character creation if page class is not available
						const characterCreator = new CharacterCreator();
						await characterCreator.pShow();
					}
				} catch (error) {
					// console.error("Fallback button handler error:", error);
					alert(`Failed to open character creator: ${error.message}`);
				}
			});

			// console.log("Fallback button handler initialized");
		}
	}, 1000);
});
