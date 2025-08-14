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
			listSyntax: new ListSyntaxCharacters({fnGetDataList: () => this._dataList}),
		});

		this._sublistManager = new CharactersSublistManager();
	}

	async _pGetBrewData () {
		const characters = await CharacterStorageUtil.pLoadCharacters();
		return {character: characters};
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
		// Initialize character creation button
		document.getElementById("btn-add-character").addEventListener("click", () => {
			this._pHandleAddCharacter();
		});
	}

	async _pHandleAddCharacter () {
		const characterCreator = new CharacterCreator();
		await characterCreator.pShow();
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



// Render utility for characters
class RenderCharacters {
	static $getRenderedCharacter (character) {
		const $content = $(`<table class="w-100 stats stats--book stats--character"><tbody></tbody></table>`);
		const $tbody = $content.find(`tbody`);

		$tbody.append(`<tr><th class="ve-tbl-border" colspan="6"></th></tr>`);

		// Character header
		$tbody.append(`<tr><td colspan="6">
			<div class="character-statblock">
				<div class="character-header">
					<h1 class="character-name">${character.name}</h1>
					<div class="character-meta">
						Level ${character.level || 1} ${character.race ? character.race.name : "Unknown"} ${character.class ? character.class.name : "Unknown"}
					</div>
				</div>
			</div>
		</td></tr>`);

		// Basic character info
		if (character.abilityScores) {
			$tbody.append(`<tr><td colspan="6">
				<div class="character-abilities">
					<h3>Ability Scores</h3>
					<div class="character-abilities-grid">
						<div><strong>STR:</strong> ${character.abilityScores.str || 10} (${Math.floor(((character.abilityScores.str || 10) - 10) / 2)})</div>
						<div><strong>DEX:</strong> ${character.abilityScores.dex || 10} (${Math.floor(((character.abilityScores.dex || 10) - 10) / 2)})</div>
						<div><strong>CON:</strong> ${character.abilityScores.con || 10} (${Math.floor(((character.abilityScores.con || 10) - 10) / 2)})</div>
						<div><strong>INT:</strong> ${character.abilityScores.int || 10} (${Math.floor(((character.abilityScores.int || 10) - 10) / 2)})</div>
						<div><strong>WIS:</strong> ${character.abilityScores.wis || 10} (${Math.floor(((character.abilityScores.wis || 10) - 10) / 2)})</div>
						<div><strong>CHA:</strong> ${character.abilityScores.cha || 10} (${Math.floor(((character.abilityScores.cha || 10) - 10) / 2)})</div>
					</div>
				</div>
			</td></tr>`);
		}

		// Custom notes
		if (character.customNotes) {
			$tbody.append(`<tr><td colspan="6">
				<div class="character-notes">
					<h3>Notes</h3>
					<p>${character.customNotes}</p>
				</div>
			</td></tr>`);
		}

		$tbody.append(`<tr><th class="ve-tbl-border" colspan="6"></th></tr>`);

		return $content;
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
		this._steps = [
			{
				title: "Basic Information",
				render: () => this._renderBasicInfoStep(),
				validate: () => this._validateBasicInfo(),
			},
		];
	}

	async pShow () {
		this._currentStep = 0;
		this._characterData = CharacterUtil.getDefaultCharacterData();

		const progressPercent = ((this._currentStep + 1) / this._steps.length) * 100;
		const stepTitle = this._steps[this._currentStep].title;
		const stepContent = this._steps[this._currentStep].render();
		const isLastStep = this._currentStep === this._steps.length - 1;

		this._$modal = $(`
			<div class="modal fade" tabindex="-1" role="dialog">
				<div class="modal-dialog modal-lg" role="document">
					<div class="modal-content">
						<div class="modal-header">
							<h4 class="modal-title">Create New Character</h4>
							<button type="button" class="close" data-dismiss="modal" aria-label="Close">
								<span aria-hidden="true">&times;</span>
							</button>
						</div>
						<div class="modal-body">
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
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
							<button type="button" class="btn btn-default" id="btn-prev-step" ${this._currentStep === 0 ? 'disabled' : ''}>Previous</button>
							<button type="button" class="btn btn-primary" id="btn-next-step">${isLastStep ? 'Create Character' : 'Next'}</button>
						</div>
					</div>
				</div>
			</div>
		`);

		// Wire up event handlers
		this._$modal.find("#btn-next-step").on("click", () => this._handleNextStep());
		this._$modal.find("#btn-prev-step").on("click", () => this._handlePrevStep());

		// Show modal
		this._$modal.modal("show");

		// Clean up when modal is closed
		this._$modal.on("hidden.bs.modal", () => {
			this._$modal.remove();
		});
	}

	_renderBasicInfoStep () {
		return `
			<div class="form-group">
				<label for="character-name">Character Name *</label>
				<input type="text" class="form-control" id="character-name" placeholder="Enter character name" value="${this._characterData.name}" required>
				<div class="invalid-feedback" id="name-error"></div>
			</div>
			<div class="form-group">
				<label for="character-level">Level *</label>
				<select class="form-control" id="character-level">
					${Array.from({length: 20}, (_, i) => i + 1).map(level =>
						`<option value="${level}" ${this._characterData.level === level ? 'selected' : ''}>${level}</option>`
					).join('')}
				</select>
			</div>
			<div class="form-group">
				<label for="character-notes">Notes (Optional)</label>
				<textarea class="form-control" id="character-notes" rows="3" placeholder="Add any notes about your character...">${this._characterData.customNotes}</textarea>
			</div>
		`;
	}

	_validateBasicInfo () {
		const name = this._$modal.find("#character-name").val().trim();
		const level = parseInt(this._$modal.find("#character-level").val());
		const notes = this._$modal.find("#character-notes").val().trim();

		// Clear previous errors
		this._$modal.find(".form-control").removeClass("is-invalid");
		this._$modal.find(".invalid-feedback").text("");

		let isValid = true;

		// Validate name
		if (!name) {
			this._$modal.find("#character-name").addClass("is-invalid");
			this._$modal.find("#name-error").text("Character name is required");
			isValid = false;
		} else if (name.length > 100) {
			this._$modal.find("#character-name").addClass("is-invalid");
			this._$modal.find("#name-error").text("Character name must be 100 characters or less");
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
		this._updateModal();
	}

	_handlePrevStep () {
		if (this._currentStep > 0) {
			this._currentStep--;
			this._updateModal();
		}
	}

	_updateModal () {
		// Update progress bar
		const progressPercent = ((this._currentStep + 1) / this._steps.length) * 100;
		this._$modal.find(".progress-bar").css("width", `${progressPercent}%`);

		// Update step indicator
		this._$modal.find(".step-indicator").text(`Step ${this._currentStep + 1} of ${this._steps.length}: ${this._steps[this._currentStep].title}`);

		// Update content
		this._$modal.find(".character-creator-content").html(this._steps[this._currentStep].render());

		// Update buttons
		this._$modal.find("#btn-prev-step").prop("disabled", this._currentStep === 0);
		this._$modal.find("#btn-next-step").text(this._currentStep === this._steps.length - 1 ? 'Create Character' : 'Next');
	}

	async _createCharacter () {
		try {
			// Show loading state
			const $nextBtn = this._$modal.find("#btn-next-step");
			const originalText = $nextBtn.text();
			$nextBtn.prop("disabled", true).text("Creating...");

			// Create and save character
			const character = CharacterUtil.createNewCharacter(this._characterData);
			await CharacterStorageUtil.pAddCharacter(character);

			// Close modal
			this._$modal.modal("hide");

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
			console.error("Failed to create character:", error);

			// Restore button state
			const $nextBtn = this._$modal.find("#btn-next-step");
			$nextBtn.prop("disabled", false).text("Create Character");

			// Show error message
			JqueryUtil.doToast({
				content: "Failed to create character. Please try again.",
				type: "danger",
			});
		}
	}
}

// Initialize the page
const charactersPage = new CharactersPage();
window.charactersPage = charactersPage; // Make it globally accessible for the character creator
window.addEventListener("load", () => charactersPage.pOnLoad());
