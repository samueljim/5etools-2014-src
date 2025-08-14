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
			const sublistSort = document.getElementById("sublistsort");

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
		// Initialize character creation button with a slight delay to ensure DOM is ready
		setTimeout(() => {
			const addCharacterBtn = document.getElementById("btn-add-character");
			if (addCharacterBtn) {
				addCharacterBtn.addEventListener("click", (e) => {
					e.preventDefault();
					this._pHandleAddCharacter();
				});
				// Log success for debugging (development only)
				// console.log("Add Character button initialized successfully");
			} else {
				// Log warning for debugging (development only)
				// console.warn("Add Character button not found in DOM");
			}
		}, 100);
	}

	async _pHandleAddCharacter () {
		// Log that the handler was called (development only)
		// console.log("Add Character button clicked - opening character creator");

		try {
			const characterCreator = new CharacterCreator();
			await characterCreator.pShow();
		} catch (error) {
			// Log error for debugging (development only)
			// console.warn("Error opening character creator:", error);

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

// Character creation wizard
class CharacterCreator {
	constructor () {
		this._$modal = null;
		this._currentStep = 0;
		this._characterData = CharacterUtil.getDefaultCharacterData();
		this._raceOptions = [];
		this._subraceOptions = [];
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
		];
	}

	async pShow () {
		// Log that the modal is being shown (development only)
		// console.log("CharacterCreator.pShow() called");

		this._currentStep = 0;
		this._characterData = CharacterUtil.getDefaultCharacterData();

		// Check if required utilities are available
		if (typeof UiUtil === "undefined" || !UiUtil.getShowModal) {
			throw new Error("UiUtil.getShowModal is not available");
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
				.race-list-container {
					max-height: 400px;
					overflow-y: auto;
					border: 1px solid #e69a28;
					border-radius: 4px;
					background-color: #fdf1dc;
				}
				.race-list {
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
		if (this._currentStep === 0) {
			// Basic info step
			this._$modalInner.find("#character-name").off("input").on("input", () => this._validateNameRealTime());
		} else if (this._currentStep === 1) {
			// Race selection step
			this._initializeRaceSelection();
		}
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
					<div class="invalid-feedback" id="name-error"></div>
					<small class="form-text text-muted">Choose a unique name for your character (max 100 characters)</small>
				</div>

				<div class="form-group">
					<label for="character-level" class="ve-flex-v-center">
						<span>Starting Level</span>
						<span class="text-danger ml-1">*</span>
					</label>
					<select class="form-control" id="character-level">
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

				<div id="selected-race-info" class="alert alert-success" style="display: none;">
					<div class="ve-flex-v-center">
						<strong>Selected Race:</strong>
						<span id="selected-race-name" class="ml-2"></span>
						<button type="button" class="ve-btn ve-btn-xs ve-btn-default ml-auto" id="btn-clear-race">Change Selection</button>
					</div>
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

				<div class="alert alert-info mt-3">
					<strong>Note:</strong> Selecting a race will automatically apply racial traits, ability score improvements, and proficiencies to your character.
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
				this._characterData = await CharacterRaceUtil.pApplyRaceToCharacter(
					this._characterData,
					this._selectedRace.name,
					this._selectedRace.source,
					subraceValue || null
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
		if (!this._steps[this._currentStep].validate()) {
			return;
		}

		// If this is the last step, create the character
		if (this._currentStep === this._steps.length - 1) {
			await this._createCharacter();
			return;
		}

		// Move to next step
		this._currentStep++;
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
			// Load all race data using the 5etools data utilities
			const raceData = await DataUtil.race.loadJSON({isAddBaseRaces: false});
			this._allRaces = raceData.race || [];
			this._selectedRace = null;

			// Set up event handlers
			const $raceSearch = this._$modalInner.find("#race-search");
			$raceSearch.off("input").on("input", () => this._handleRaceSearch());

			this._$modalInner.find("#character-subrace").off("change").on("change", () => this._handleSubraceChange());
			this._$modalInner.find("#btn-clear-race").off("click").on("click", () => this._clearRaceSelection());

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

		// Sort races by name
		const sortedRaces = [...this._allRaces].sort((a, b) => a.name.localeCompare(b.name));

		// Generate race cards
		const raceCardsHtml = sortedRaces.map(race => this._generateRaceCard(race)).join('');
		
		$raceList.html(raceCardsHtml);

		// Add click handlers to race cards
		$raceList.find('.race-card').off('click').on('click', (e) => {
			const raceValue = $(e.currentTarget).data('race-value');
			this._selectRaceFromCard(raceValue);
		});
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

		// Check for subraces
		const hasSubraces = race.subraces && race.subraces.length > 0;

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

		$raceCards.each((i, card) => {
			const $card = $(card);
			const raceName = $card.find(".race-card-name").text().toLowerCase();
			const raceSource = $card.find(".race-card-source").text().toLowerCase();
			
			if (!searchTerm || raceName.includes(searchTerm) || raceSource.includes(searchTerm)) {
				$card.show();
			} else {
				$card.hide();
			}
		});
	}

	_selectRaceFromCard (raceValue) {
		const [raceName, raceSource] = raceValue.split("|");
		const race = this._allRaces.find(r => r.name === raceName && r.source === raceSource);
		
		if (!race) return;

		// Update selected race
		this._selectedRace = {
			name: raceName,
			source: raceSource,
			value: raceValue,
			race: race
		};

		// Update UI
		this._updateRaceSelection(race);
		this._displayRaceDetails(race);
	}

	_updateRaceSelection (race) {
		// Clear previous selection
		this._$modalInner.find(".race-card").removeClass("selected");
		
		// Mark selected card
		this._$modalInner.find(`.race-card[data-race-value="${race.name}|${race.source}"]`).addClass("selected");

		// Show selected race info
		const $selectedRaceInfo = this._$modalInner.find("#selected-race-info");
		const $selectedRaceName = this._$modalInner.find("#selected-race-name");
		
		$selectedRaceName.text(`${race.name} (${Parser.sourceJsonToAbv(race.source)})`);
		$selectedRaceInfo.show();

		// Handle subraces
		this._handleRaceChange(race.name, race.source);
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
		this._$modalInner.find("#selected-race-info").hide();
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

			// Check for subraces
			if (race.subraces && race.subraces.length > 0) {
				// Show subrace selection
				$subraceSelect.html('<option value="">Select a subrace...</option>');
				
				race.subraces.forEach(subrace => {
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
		if (subraceValue && race.subraces) {
			const subrace = race.subraces.find(sr => sr.name === subraceValue);
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
