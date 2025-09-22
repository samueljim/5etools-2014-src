// CharacterSpellManager - provides spell selection UI matching spells.html
class CharacterSpellManager extends ListPage {
	constructor() {
		const pageFilter = new PageFilterSpells({
			sourceFilterOpts: {
				pFnOnChange: (...args) => this._pLoadSource(...args),
			},
		});
		
		super({
			dataSource: DataUtil.spell.loadJSON.bind(DataUtil.spell),
			dataSourceFluff: DataUtil.spellFluff.loadJSON.bind(DataUtil.spellFluff),
			pageFilter,
			listClass: "spells",
			dataProps: ["spell"],
		});

		this._selectedSpells = new Map();
		this._onComplete = null;
		this._$modalInner = null;
		this._doClose = null;
		this._seenHashes = new Set();
		this._characterData = null; // Store character context for filtering
	}

	// Parse existing spells from character data to pre-select them
	_parseExistingSpells(characterData) {
		console.log("📖 Parsing existing character spells...");
		
		if (!characterData?.spells?.levels) {
			console.log("No existing spells found");
			return;
		}

		// Extract spell names from all spell levels
		const existingSpellNames = new Set();
		Object.keys(characterData.spells.levels).forEach(level => {
			const levelData = characterData.spells.levels[level];
			if (levelData?.spells && Array.isArray(levelData.spells)) {
				levelData.spells.forEach(spellName => {
					// Handle spell names with source (e.g., "Aganazzar's Scorcher|XGE")
					const cleanSpellName = spellName.split('|')[0];
					existingSpellNames.add(cleanSpellName);
				});
			}
		});

		console.log(`Found ${existingSpellNames.size} existing spells:`, Array.from(existingSpellNames));
		this._existingSpellNames = existingSpellNames;
	}

	// Check if a spell is currently selected by the character
	_isSpellSelected(spellName) {
		return this._existingSpellNames && this._existingSpellNames.has(spellName);
	}

		// Main entry point - opens the spell selection modal
	async openSpellManager(characterData, onComplete) {
		console.log("🎯 Opening spell manager...");
		console.log("Character data:", characterData);
		
		this._characterData = characterData; // Store for filter context
		this._onComplete = onComplete;
		
		// Parse existing spells from character data
		this._parseExistingSpells(characterData);
		
		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: "Select Spells for Character",
			isHeight100: true,
			isWidth100: true,
			isUncappedHeight: true,
			isHeaderBorder: true,
			cbClose: () => {
				console.log("� Spell manager closed");
			}
		});

		this._$modalInner = $modalInner;
		this._doClose = doClose;

		// Create the same DOM structure as spells.html
		await this._pRenderModalContent();
		
		// Initialize the page system
		await this.pOnLoad();
		
		// Set up our custom event handlers
		this._setupEventHandlers();
	}

	// Creates the DOM structure matching spells.html
	async _pRenderModalContent() {
		const htmlStructure = `
			<div class="view-col-group h-100 mh-0">
				<div class="view-col-wrapper">
					<div class="view-col ve-flex-7" id="listcontainer">
						<div class="lst__form-top" id="filter-search-group">
							<div class="w-100 relative">
								<input type="search" id="lst__search" autocomplete="off" autocapitalize="off" spellcheck="false" class="search form-control lst__search lst__search--no-border-h">
								<div id="lst__search-glass" class="lst__wrp-search-glass no-events ve-flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>
								<div class="lst__wrp-search-visible no-events ve-flex-vh-center"></div>
							</div>
							<button type="button" class="ve-btn ve-btn-default" id="reset">Reset</button>
						</div>

						<div class="filterbox">
							<div class="ve-flex-col">
								<div class="lst__form-bottom"></div>
							</div>
						</div>

						<div id="filtertools" class="input-group input-group--bottom ve-flex no-shrink">
							<button type="button" class="ve-col-2-9 sort ve-btn ve-btn-default ve-btn-xs" data-sort="name">Name</button>
							<button type="button" class="ve-col-1-5 sort ve-btn ve-btn-default ve-btn-xs" data-sort="level">Level</button>
							<button type="button" class="ve-col-1-7 sort ve-btn ve-btn-default ve-btn-xs" data-sort="time">Time</button>
							<button type="button" class="ve-col-1-2 sort ve-btn ve-btn-default ve-btn-xs" data-sort="school">School</button>
							<button type="button" class="ve-col-0-6 sort ve-btn ve-btn-default ve-btn-xs" data-sort="concentration" title="Concentration">C.</button>
							<button type="button" class="ve-col-2-4 sort ve-btn ve-btn-default ve-btn-xs" data-sort="range">Range</button>
							<button type="button" class="sort ve-btn ve-btn-default ve-btn-xs ve-grow" data-sort="source">Source</button>
						</div>

						<div id="list" class="list list--stats"></div>
					</div>
					
					<div id="contentwrapper" class="view-col ve-flex-5">
						<div class="w-100 ve-flex" id="stat-tabs">
							<div class="ml-auto ve-flex" id="tabs-right"></div>
						</div>

						<div id="wrp-pagecontent" class="relative wrp-stats-table">
							<table id="pagecontent" class="w-100 stats">
								<tr><th class="ve-tbl-border" colspan="6"></th></tr>
								<tr><td colspan="6" class="initial-message initial-message--med">Select a spell to view it here</td></tr>
								<tr><th class="ve-tbl-border" colspan="6"></th></tr>
							</table>
						</div>

						<div class="ve-flex-vh-center mt-2 no-print">
							<div class="ve-flex-v-center mr-3">
								<span>Selected: <span id="selected-count">0</span> spells</span>
							</div>
							<div class="ve-flex-v-center">
								<button type="button" id="btn-add-selected" class="ve-btn ve-btn-primary mr-2">Add Selected</button>
								<button type="button" id="btn-cancel" class="ve-btn ve-btn-default">Cancel</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
		
		this._$modalInner.html(htmlStructure);
	}

	// Set up event handlers for our custom modal buttons
	_setupEventHandlers() {
		this._$modalInner.find('#btn-add-selected').click(() => {
			const selectedSpells = this.getSelectedSpells();
			console.log("🔮 Selected spells:", selectedSpells);
			if (this._onComplete) {
				this._onComplete(selectedSpells);
			}
			if (this._doClose) {
				this._doClose();
			}
		});

		this._$modalInner.find('#btn-cancel').click(() => {
			if (this._doClose) {
				this._doClose();
			}
		});
	}

	getSelectedSpells() {
		return Array.from(this._selectedSpells.values());
	}

	// Required by PageFilterSpells for source loading
	async _pLoadSource() {
		// This is called by the filter system, we can use empty implementation
		// since we load all data in pOnLoad
		return Promise.resolve();
	}

	// Override getListItem to add spell selection functionality
	getListItem(spell, spI) {
		const hash = `${spell.name}|${spell.source}`.toLowerCase();

		const eleLi = document.createElement("div");
		eleLi.className = "lst__row ve-flex-col";
		eleLi.addEventListener("click", (evt) => {
			this._list.doSelect(listItem, evt);
			this._renderStats_doBuildStatsTab({ent: spell});
		});		const source = Parser.sourceJsonToAbv(spell.source);
		const levelText = PageFilterSpells.getTblLevelStr(spell);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const concentration = spell.concentration ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		const listItem = new ListItem(
			spI,
			eleLi,
			spell.name,
			{
				hash,
				source,
				level: spell.level,
				time,
				school,
				concentration,
				range,
				normalisedTime: spell.time,
				normalisedRange: spell.range,
			},
			{
				entity: spell,
			}
		);

		// Create checkbox for spell selection
		const eleCheckbox = document.createElement("input");
		eleCheckbox.type = "checkbox";
		eleCheckbox.className = "mr-2";
		
		// Pre-check if this spell is already selected by the character
		const isAlreadySelected = this._isSpellSelected(spell.name);
		if (isAlreadySelected) {
			eleCheckbox.checked = true;
			this._selectedSpells.set(hash, spell);
		}
		
		eleCheckbox.addEventListener("change", () => {
			if (eleCheckbox.checked) {
				this._selectedSpells.set(hash, spell);
			} else {
				this._selectedSpells.delete(hash);
			}
			this._updateSelectedCount();
		});

		const eleRow = document.createElement("div");
		eleRow.className = "ve-flex-v-center w-100 lst__row-inner";

		// Create spell name element
		const eleSpellName = document.createElement("span");
		eleSpellName.className = "bold ve-col-2-9 pl-0";
		eleSpellName.textContent = spell.name;

		// Create spell level element
		const eleSpellLevel = document.createElement("span");
		eleSpellLevel.className = "ve-text-center ve-col-1-5";
		eleSpellLevel.textContent = levelText;

		// Create spell time element
		const eleSpellTime = document.createElement("span");
		eleSpellTime.className = "ve-text-center ve-col-1-7";
		eleSpellTime.textContent = time;

		// Create spell school element
		const eleSpellSchool = document.createElement("span");
		eleSpellSchool.className = "ve-text-center ve-col-1-2";
		eleSpellSchool.textContent = school;

		// Create spell concentration element
		const eleSpellConcentration = document.createElement("span");
		eleSpellConcentration.className = "ve-text-center ve-col-0-6";
		eleSpellConcentration.textContent = concentration;

		// Create spell range element
		const eleSpellRange = document.createElement("span");
		eleSpellRange.className = "ve-text-center ve-col-2-4";
		eleSpellRange.textContent = range;

		// Create spell source element
		const eleSpellSource = document.createElement("span");
		eleSpellSource.className = "ve-text-center ve-grow";
		eleSpellSource.textContent = source;

		// Append all elements to row
		eleRow.appendChild(eleCheckbox);
		eleRow.appendChild(eleSpellName);
		eleRow.appendChild(eleSpellLevel);
		eleRow.appendChild(eleSpellTime);
		eleRow.appendChild(eleSpellSchool);
		eleRow.appendChild(eleSpellConcentration);
		eleRow.appendChild(eleSpellRange);
		eleRow.appendChild(eleSpellSource);

		eleLi.appendChild(eleRow);
		return listItem;
	}

	_updateSelectedCount() {
		const count = this._selectedSpells.size;
		const $counter = this._$modalInner.find('#selected-count');
		if ($counter.length) {
			$counter.text(count);
		}
	}

	// Override stats rendering for modal context
	_renderStats_doBuildStatsTab({ent}) {
		this._renderStats_doBuildStatsTab_spell({ent});
	}

	_renderStats_doBuildStatsTab_spell({ent}) {
		try {
			this._$pgContent = this._$modalInner.find("#pagecontent");
			// Use the same rendering as spells.html
			if (typeof RenderSpells !== 'undefined' && RenderSpells.getRenderedSpell) {
				this._$pgContent.empty().append(RenderSpells.getRenderedSpell(ent, {
					subclassLookup: {}, // Could be enhanced with actual subclass lookup
					settings: {} // Could be enhanced with spell display settings
				}));
			} else {
				// Fallback rendering if RenderSpells not available
				this._renderBasicSpellPreview(ent);
			}
		} catch (error) {
			console.error("Error rendering spell:", error);
			this._renderBasicSpellPreview(ent);
		}
	}

	_renderBasicSpellPreview(ent) {
		// Enhanced fallback rendering with proper 5etools-style formatting
		const levelText = ent.level === 0 ? "Cantrip" : `Level ${ent.level}`;
		const school = Parser.spSchoolAbvToFull ? Parser.spSchoolAbvToFull(ent.school) : ent.school;
		const time = Parser.spTimeListToFull ? Parser.spTimeListToFull(ent.time) : PageFilterSpells.getTblTimeStr(ent.time[0]);
		const range = Parser.spRangeToFull(ent.range);
		const components = Parser.spComponentsToFull ? Parser.spComponentsToFull(ent.components, ent.level) : "Components info";
		const duration = Parser.spDurationToFull ? Parser.spDurationToFull(ent.duration) : "Duration info";
		
		// Try to use Renderer.get() for proper text rendering with links
		let entriesHtml = "";
		if (ent.entries && typeof Renderer !== 'undefined' && Renderer.get) {
			try {
				const renderer = Renderer.get();
				entriesHtml = ent.entries.map(entry => renderer.render(entry)).join("");
			} catch (e) {
				// Fallback to basic text
				entriesHtml = ent.entries ? ent.entries.map(entry => `<p>${entry}</p>`).join('') : "";
			}
		} else {
			entriesHtml = ent.entries ? ent.entries.map(entry => `<p>${entry}</p>`).join('') : "";
		}

		const html = `
			<table class="stats stats--book">
				<tr><th class="border" colspan="6"></th></tr>
				<tr><th class="stats-name" colspan="6">${ent.name}</th></tr>
				<tr><th class="stats-source" colspan="6">${levelText} ${school}</th></tr>
				<tr><th class="border" colspan="6"></th></tr>
				<tr><td colspan="6"><strong>Casting Time:</strong> ${time}</td></tr>
				<tr><td colspan="6"><strong>Range:</strong> ${range}</td></tr>
				<tr><td colspan="6"><strong>Components:</strong> ${components}</td></tr>
				<tr><td colspan="6"><strong>Duration:</strong> ${duration}</td></tr>
				<tr><th class="border" colspan="6"></th></tr>
				<tr><td class="divider" colspan="6"><div></div></td></tr>
				<tr><td colspan="6">${entriesHtml}</td></tr>
				<tr><th class="border" colspan="6"></th></tr>
			</table>
		`;
		
		this._$pgContent.empty().html(html);
	}

	// Override primary list initialization for modal context
	async _pOnLoad_pInitPrimaryLists() {
		const $iptSearch = this._$modalInner.find("#lst__search");
		const $btnReset = this._$modalInner.find("#reset");
		
		this._list = new List({
			$iptSearch,
			$wrpList: this._$modalInner.find("#list"),
			fnSort: SortUtil.listSort,
			syntax: this._listSyntax.build(),
			isBindFindHotkey: true,
			optsList: this._listOptions,
		});
		
		const wrpBtnsSort = this._$modalInner.find("#filtertools")[0];
		if (wrpBtnsSort) {
			SortUtil.initBtnSortHandlers(wrpBtnsSort, this._list);
		}

		// Initialize the filter box with class/subclass filters
		this._filterBox = await this._pageFilter.pInitFilterBox({
			$iptSearch,
			$wrpFormTop: this._$modalInner.find(`#filter-search-group`),
			$wrpFormBottom: this._$modalInner.find(`.lst__form-bottom`),
			$btnReset,
		});
	}

	// Override visible items display for modal context
	_pOnLoad_initVisibleItemsDisplay() {
		const $outVisibleResults = this._$modalInner.find(`.lst__wrp-search-visible`);
		this._list.on("updated", () => $outVisibleResults.html(`${this._list.visibleItems.length}/${this._list.items.length}`));
	}

	// Override data loading to work without URL hash dependencies
	async pOnLoad() {
		// Initialize the list system first
		await this._pOnLoad_pInitPrimaryLists();
		this._pOnLoad_initVisibleItemsDisplay();
		
		// Load spell data and add to list
		try {
			const spellData = await DataUtil.spell.loadJSON();
			if (spellData && spellData.spell) {
				this._addData(spellData.spell);
				
				// If we have character data, log class information for filtering
				if (this._characterData) {
					console.log("📊 Character classes for filtering:");
					if (this._characterData.class && Array.isArray(this._characterData.class)) {
						this._characterData.class.forEach(cls => {
							console.log(`  - ${cls.name} (level ${cls.level || 1})`);
							if (cls.subclass) {
								console.log(`    └── ${cls.subclass.name}`);
							}
						});
					}
				}
			}
		} catch (error) {
			console.error("Error loading spell data:", error);
		}
		
		console.log("✅ CharacterSpellManager loaded successfully");
	}

	// Override data addition for modal context
	_addData(data) {
		if (!data || !data.length) return;

		console.log(`📚 Adding ${data.length} spells to list...`);

		// Initialize seen hashes if not already done
		if (!this._seenHashes) {
			this._seenHashes = new Set();
		}
		
		data.forEach((spell, i) => {
			const listItem = this.getListItem(spell, i);
			if (listItem) {
				this._list.addItem(listItem);
			}
		});

		this._list.init();

		// Update selected count after pre-selecting existing spells
		this._updateSelectedCount();

		// Update visible count display
		const $outVisibleResults = this._$modalInner.find(`.lst__wrp-search-visible`);
		if ($outVisibleResults.length) {
			$outVisibleResults.html(`${this._list.visibleItems.length}/${this._list.items.length}`);
		}
		
		console.log(`✅ Successfully loaded ${data.length} spells`);
		console.log(`🎯 Pre-selected ${this._selectedSpells.size} existing spells`);
	}
}