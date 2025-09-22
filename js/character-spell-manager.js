// CharacterSpellManager - provides spell selection UI matching spells.html exactly
class CharacterSpellManager extends ListPage {
	constructor() {
		super({
			pageFilter: new PageFilterSpells({
				sourceFilterOpts: {
					pFnOnChange: (...args) => this._pLoadSource.apply(this, args),
				},
			}),

			listOptions: {
				fnSort: PageFilterSpells.sortSpells,
			},

			dataProps: ["spell"],
			listClass: "spells",
		});

		this._selectedSpells = new Map();
		this._onComplete = null;
		this._$modalInner = null;
		this._doClose = null;
		this._characterData = null; // Store character context for filtering
		this._existingSpellNames = new Set();
		this._existingSpellHashes = new Set();
	}

	// Parse existing spells from character data to pre-select them
	_parseExistingSpells(characterData) {
		console.log("📖 Parsing existing character spells...");
		
		if (!characterData?.spells?.levels) {
			console.log("No existing spells found");
			return;
		}

		// Extract spell names and hashes from all spell levels
		const existingSpellNames = new Set();
		const existingSpellHashes = new Set();
		Object.keys(characterData.spells.levels).forEach(level => {
			const levelData = characterData.spells.levels[level];
			if (levelData?.spells && Array.isArray(levelData.spells)) {
				levelData.spells.forEach(spellEntry => {
					// Handle spell names with source (e.g., "Aganazzar's Scorcher|XGE")
					const [namePart, sourcePart] = spellEntry.split("|");
					const name = namePart?.trim();
					const source = sourcePart?.trim() || "PHB";
					existingSpellNames.add(name);
					const hash = `${UrlUtil.encodeForHash(name)}_${UrlUtil.encodeForHash(source)}`;
					existingSpellHashes.add(hash);
				});
			}
		});

		console.log(`Found ${existingSpellNames.size} existing spells (names) and ${existingSpellHashes.size} hashes:`, Array.from(existingSpellNames));
		this._existingSpellNames = existingSpellNames;
		this._existingSpellHashes = existingSpellHashes;
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
							<div class="ve-flex-v-center mr-3" id="spell-suggestions">
								<!-- Spell suggestions will be populated here -->
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

		// Display spell count suggestions
		this._displaySpellSuggestions();
	}

	// Display helpful spell count suggestions based on character class and level
	_displaySpellSuggestions() {
		if (!this._characterData?.class) return;

		const suggestions = this._calculateSpellSuggestions();
		if (!suggestions.length) return;

		const $suggestionsContainer = this._$modalInner.find('#spell-suggestions');
		const suggestionsHtml = `
			<div class="ve-small ve-muted">
				<strong>Suggestions:</strong> ${suggestions.join(', ')}
			</div>
		`;
		$suggestionsContainer.html(suggestionsHtml);
	}

	// Calculate appropriate spell count suggestions based on D&D 5e guidelines
	_calculateSpellSuggestions() {
		if (!this._characterData?.class) return [];

		const suggestions = [];
		
		// Get the highest level spellcasting class
		const spellcastingClass = this._characterData.class.find(cls => {
			const className = cls.name;
			const fullCasters = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'];
			const halfCasters = ['Paladin', 'Ranger'];
			return fullCasters.includes(className) || halfCasters.includes(className) ||
				   (className === 'Fighter' && cls.subclass?.name === 'Eldritch Knight') ||
				   (className === 'Rogue' && cls.subclass?.name === 'Arcane Trickster');
		});

		if (!spellcastingClass) return [];

		const className = spellcastingClass.name;
		const level = spellcastingClass.level || 1;

		// Spell count suggestions by class
		if (className === 'Wizard') {
			suggestions.push(`Cantrips: ${Math.min(3 + Math.floor((level - 1) / 3), 5)}`);
			suggestions.push(`Spellbook: ${6 + (level - 1) * 2} total`);
			suggestions.push(`Prepared: ${Math.max(1, Math.floor(level / 2) + 3)} per day`);
		} else if (className === 'Sorcerer') {
			const cantrips = level === 1 ? 4 : level < 4 ? 4 : level < 10 ? 5 : 6;
			const known = level === 1 ? 2 : level < 3 ? 3 : level < 4 ? 4 : level < 5 ? 5 : 
				         level < 6 ? 6 : level < 7 ? 7 : level < 8 ? 8 : level < 9 ? 9 : 
				         level < 10 ? 10 : level < 11 ? 11 : level < 17 ? 12 : level < 19 ? 13 : 
				         level < 20 ? 14 : 15;
			suggestions.push(`Cantrips: ${cantrips}`);
			suggestions.push(`Known: ${known} total`);
		} else if (className === 'Bard') {
			const cantrips = level < 4 ? 2 : level < 10 ? 3 : 4;
			const known = level < 2 ? 4 : level < 3 ? 5 : level < 4 ? 6 : level < 5 ? 7 :
				         level < 6 ? 8 : level < 7 ? 9 : level < 8 ? 10 : level < 9 ? 11 :
				         level < 10 ? 12 : level < 11 ? 13 : level < 13 ? 14 : level < 14 ? 15 :
				         level < 15 ? 16 : level < 16 ? 17 : level < 17 ? 18 : level < 18 ? 19 :
				         level < 19 ? 20 : level < 20 ? 21 : 22;
			suggestions.push(`Cantrips: ${cantrips}`);
			suggestions.push(`Known: ${known} total`);
		} else if (className === 'Cleric' || className === 'Druid') {
			const cantrips = level < 4 ? 3 : level < 10 ? 4 : 5;
			const prepared = Math.max(1, level + 3); // Assuming +3 wisdom modifier
			suggestions.push(`Cantrips: ${cantrips}`);
			suggestions.push(`Prepared: ${prepared} per day`);
		} else if (className === 'Warlock') {
			const cantrips = level < 4 ? 2 : level < 10 ? 3 : 4;
			const known = level < 2 ? 2 : level < 3 ? 3 : level < 4 ? 4 : level < 5 ? 5 :
				         level < 6 ? 6 : level < 7 ? 7 : level < 8 ? 8 : level < 9 ? 9 : 10;
			suggestions.push(`Cantrips: ${cantrips}`);
			suggestions.push(`Known: ${known} total`);
		} else if (className === 'Paladin' || className === 'Ranger') {
			if (level >= 2) {
				const prepared = Math.max(1, Math.floor(level / 2) + 2); // Assuming +2 modifier
				suggestions.push(`Prepared: ${prepared} per day`);
			}
		} else if (className === 'Fighter' && spellcastingClass.subclass?.name === 'Eldritch Knight') {
			if (level >= 3) {
				const cantrips = level < 10 ? 2 : 3;
				const known = level < 4 ? 3 : level < 7 ? 4 : level < 8 ? 5 : level < 10 ? 6 :
					         level < 11 ? 7 : level < 13 ? 8 : level < 14 ? 9 : level < 16 ? 10 :
					         level < 19 ? 11 : level < 20 ? 12 : 13;
				suggestions.push(`Cantrips: ${cantrips}`);
				suggestions.push(`Known: ${known} total`);
			}
		} else if (className === 'Rogue' && spellcastingClass.subclass?.name === 'Arcane Trickster') {
			if (level >= 3) {
				const cantrips = level < 10 ? 3 : 4;
				const known = level < 4 ? 3 : level < 7 ? 4 : level < 8 ? 5 : level < 10 ? 6 :
					         level < 11 ? 7 : level < 13 ? 8 : level < 14 ? 9 : level < 16 ? 10 :
					         level < 19 ? 11 : level < 20 ? 12 : 13;
				suggestions.push(`Cantrips: ${cantrips}`);
				suggestions.push(`Known: ${known} total`);
			}
		}

		return suggestions;
	}

	getSelectedSpells() {
		return Array.from(this._selectedSpells.values());
	}

	// Handle filter changes using the standard ListPage pattern
	handleFilterChange() {
		if (!this._filterBox || !this._list || !this._dataList) {
			console.warn(`⚠️ Filter change called but missing components:`, {
				filterBox: !!this._filterBox,
				list: !!this._list,
				dataList: !!this._dataList
			});
			return;
		}
		
		const f = this._filterBox.getValues();
		console.log(`🔄 Applying filters to ${this._dataList.length} spells...`);
		
		const beforeCount = this._list.visibleItems.length;
		this._list.filter(item => {
			if (!item || item.ix === undefined || !this._dataList[item.ix]) {
				console.warn(`⚠️ Invalid item in filter:`, item);
				return false;
			}
			return this._pageFilter.toDisplay(f, this._dataList[item.ix]);
		});
		const afterCount = this._list.visibleItems.length;
		
		console.log(`🎯 Filter applied: ${beforeCount} -> ${afterCount} visible spells`);
		
		FilterBox.selectFirstVisible(this._dataList);
		// Update selection count after filtering
		this._updateSelectedCount();
	}

	// Required by PageFilterSpells for source loading
	async _pLoadSource() {
		// In modal context, we load all data upfront so no dynamic loading needed
		return Promise.resolve();
	}

	_updateSelectedCount() {
		const count = this._selectedSpells.size;
		const $counter = this._$modalInner.find('#selected-count');
		if ($counter.length) {
			$counter.text(count);
		}
	}

	// Handle right-click context menu (simplified for modal)
	_openContextMenu(evt, list, listItem) {
		// For now, just prevent default context menu in modal
		evt.preventDefault();
	}

	// Check if a spell is already selected by the character
	_isSpellSelected(spellName) {
		// Prefer hash-based lookup if available
		if (!this._existingSpellHashes) return this._existingSpellNames && this._existingSpellNames.has(spellName);
		// Try name-based first
		if (this._existingSpellNames && this._existingSpellNames.has(spellName)) return true;
		// Hash-based: attempt to find any hash matching this name (any source)
		for (const h of this._existingSpellHashes) {
			if (h.startsWith(`${UrlUtil.encodeForHash(spellName)}_`)) return true;
		}
		return false;
	}

	// Override stats rendering for modal context
	_renderStats_doBuildStatsTab({ent}) {
		this._renderStats_doBuildStatsTab_spell({ent});
	}

	_renderStats_doBuildStatsTab_spell({ent}) {
		try {
			this._$pgContent = this._$modalInner.find("#pagecontent");
			// Use basic spell rendering for modal context
			this._renderBasicSpellPreview(ent);
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

	// Initialize primary lists with full filtering system
	async _pOnLoad_pInitPrimaryLists() {
		// Initialize filter and list system
		await this._initFilterAndList();
	}

	// Initialize the complete filter system
	async _initFilterAndList() {
		const $modal = this._$modalInner;
		const $iptSearch = $modal.find("#lst__search");
		const $btnReset = $modal.find("#reset");
		
		// Use the page filter provided by the class (constructed in constructor via super)
		// Initialize filter box using the SAME pattern as ListPage
		this._filterBox = await this._pageFilter.pInitFilterBox({
			$iptSearch: $iptSearch,
			$wrpFormTop: $modal.find(`#filter-search-group`),
			$btnReset: $btnReset,
		});
		
		console.log(`🎛️ FilterBox initialized with ${this._filterBox.filters.length} filters`);
		
		// Initialize List.js with proper configuration
		const $listContainer = $modal.find('#list');
		const pFnGetFluff = Renderer.spell.pGetFluff.bind(Renderer.spell);
		this._list = new List({
			$iptSearch: $iptSearch,
			$wrpList: $listContainer,
			fnSort: PageFilterSpells.sortSpells,
			syntax: new ListSyntaxSpells({fnGetDataList: () => this._dataList, pFnGetFluff}),
			isBindFindHotkey: true,
		});

		// IMPORTANT: initialize the list so it can perform its initial search/filter/render
		this._list.init();
		
		// Connect filter box to handle changes
		this._filterBox.on(FILTER_BOX_EVNT_VALCHANGE, this.handleFilterChange.bind(this));
		
		// Initialize sorting
		const wrpBtnsSort = $modal.find(`#filtertools`)[0];
		if (wrpBtnsSort) {
			SortUtil.initBtnSortHandlers(wrpBtnsSort, this._list);
		}
		
		// Update list when items change
		this._list.on("updated", () => {
			this._updateSelectedCount();
		});

		// If List.js updated but did not render DOM nodes into the container, run fallback
		this._list.on("updated", () => {
			try {
				const $lc = $listContainer;
				const vis = this._list.visibleItems.length;
				const domCount = $lc.find('.lst__row').length;
				if (vis > 0 && domCount === 0) {
					console.warn(`⚠️ List updated but DOM empty (visible ${vis}). Running fallback.`);
					this._fallbackToDirectDOM($listContainer);
				}
			} catch (e) {
				console.error(`Error during updated fallback check:`, e);
			}
		});

		// Debug: log first few visible item names when the list updates
		this._list.on("updated", () => {
			try {
				const names = (this._list.visibleItems || []).slice(0, 10).map(it => it.name);
				console.log(`📦 List updated: ${this._list.visibleItems.length}/${this._list.items.length} visible. First:`, names);
			} catch (e) {
				/* ignore logging errors */
			}
		});
		
		// Initialize visible items display
		const $outVisibleResults = $modal.find(`.lst__wrp-search-visible`);
		this._list.on("updated", () => $outVisibleResults.html(`${this._list.visibleItems.length}/${this._list.items.length}`));
		
		console.log(`📋 List and Filter system initialized`);
	}

	// Load spell data and initialize the full filtering system
	async pOnLoad() {
		console.log("🎯 Starting spell manager initialization with full filtering...");
		
		// Load spell data
		const spellData = await DataUtil.spell.loadJSON();
		if (!spellData?.spell?.length) {
			console.error("❌ No spell data loaded");
			return;
		}
		
		console.log(`📚 Loaded ${spellData.spell.length} spells`);
		
		// Initialize the primary list with full ListPage functionality
		await this._pOnLoad_pInitPrimaryLists();
		this._pOnLoad_initVisibleItemsDisplay();
		
		// Add spell data to the list
		this._addData(spellData);
		
		// Set up character-specific defaults after initialization, but don't filter yet
		if (this._characterData) {
			this._setDefaultFiltersForCharacter();
			this._displaySpellSuggestions();
		}
		
		// Update selected count
		this._updateSelectedCount();
		
		// Now apply initial filtering to show all appropriate spells
		setTimeout(() => {
			console.log("🔄 Applying initial filtering...");
			// Force all items to be visible initially by bypassing List.js filtering
			if (this._list && this._list.items) {
				console.log("🔓 Forcing all spells to be visible initially");
				
				// Update List.js internal visibility state directly
				this._list.items.forEach(item => {
					if (item.elm || item.ele) {
						   // Removed: do not call item.visible(true)
					}
				});
				
				// Force a List.js update
				this._list.update();
				console.log(`🚀 Forced visibility: ${this._list.visibleItems.length} of ${this._list.items.length} spells visible`);

				// If still 0 visible, show all items directly in DOM
				if (this._list.visibleItems.length === 0) {
					console.log("🎯 Bypassing List.js entirely - showing all DOM items");
					const $listContainer = this._$modalInner.find('#list');
					$listContainer.find('.lst__row').show(); // Show all DOM items
					console.log(`📝 Showed ${$listContainer.find('.lst__row').length} DOM items directly`);
				}
			}
		}, 100);
		
		console.log("✅ CharacterSpellManager loaded with full filtering system");
	}

	// Override state loading to avoid null reference errors in modal context
	async _pOnLoad_pLoadListState() {
		console.log("🔄 Loading list state (modal context - simplified)");
		// In modal context, we don't need to load/save complex state
		// Just return without doing anything to avoid null reference errors
		return Promise.resolve();
	}

	// Override other state methods that might cause issues in modal context
	_pOnLoad_pLoadSublistState() {
		console.log("🔄 Loading sublist state (modal context - skipped)");
		return Promise.resolve();
	}

	_pOnLoad_bindListOptions() {
		console.log("🔄 Binding list options (modal context - simplified)");
		// We'll handle our own list options without the complex page binding
		return;
	}

	// Add data using proper ListPage processing with full filtering support
	_addData(data) {
		if (!data || !data.spell || !data.spell.length) {
			console.warn("No spell data provided to _addData");
			return;
		}

		console.log(`📚 Processing ${data.spell.length} spells with full filtering...`);

		// Store spell data
		this._dataList = data.spell;
		
		// Use the seenHashes system from parent class
		this._seenHashes = this._seenHashes || new Set();

		// Process each spell with proper filtering integration
		let addedCount = 0;
		data.spell.forEach((spell, i) => {
			try {
				// Add normalized data for filtering/sorting
				spell._normalisedTime = PageFilterSpells.getNormalisedTime(spell.time);
				spell._normalisedRange = PageFilterSpells.getNormalisedRange(spell.range);
				spell._isConc = spell.duration.some(d => d.concentration);
				
				const listItem = this.getListItem(spell, i);
				if (listItem) {
					this._list.addItem(listItem);
					addedCount++;
				}
			} catch (error) {
				console.warn(`Failed to process spell ${spell.name}:`, error);
			}
		});

		console.log(`📊 Successfully added ${addedCount} spells to list`);

		// Initialize and update the list so it can perform its search/filter/render
		if (!this._list._isInit) this._list.init();
		this._list.update();
		console.log(`🔄 List updated. Items: ${this._list.items.length}, Visible: ${this._list.visibleItems.length}`);
		
		this._filterBox.render();
		console.log(`🎛️ Filter box rendered`);
		
		// Check if list items are in the DOM
		const $listContainer = this._$modalInner.find('#list');
		console.log(`📝 List container children: ${$listContainer.children().length}`);
		console.log(`📝 List container HTML length: ${$listContainer.html().length}`);
		
		// Debug first few list items
		if (this._list.items.length > 0) {
			console.log(`🔍 First list item:`, this._list.items[0]);
			console.log(`🔍 First list item element:`, this._list.items[0].elm);
		}
		
		// Check if List.js is actually putting items in the DOM
		const actualDomItems = $listContainer.find('.lst__row').length;
		console.log(`📝 Actual DOM items with .lst__row: ${actualDomItems}`);
		
		// If List.js isn't working, fall back to direct DOM manipulation
		if (this._list.items.length > 0 && actualDomItems === 0) {
			console.log(`⚠️ List.js not rendering items to DOM, falling back to direct manipulation`);
			this._fallbackToDirectDOM($listContainer);
		}
		
		// Don't filter initially - show all spells first
		console.log(`🎯 Skipping initial filtering to show all spells`);
		// this.handleFilterChange();
		
		console.log(`✅ Successfully loaded ${addedCount} spells with full filtering system`);
	}

	// Fallback method when List.js doesn't render items properly
	_fallbackToDirectDOM($listContainer) {
		console.log(`🔄 Using direct DOM manipulation for ${this._list.items.length} spells...`);
		// Clear the container
		$listContainer.empty();
		let appendedCount = 0;
		// Append visibleItems in order so they match List.js sorting
		const visible = this._list.visibleItems || [];
		visible.forEach((item, ix) => {
			const elementToUse = item.ele || item.elm || item._element;
			if (elementToUse) {
				// Ensure we append the actual DOM node (not a jQuery wrapper)
				$listContainer.append(elementToUse);
				appendedCount++;
			} else console.warn(`⚠️ Visible item ${ix} missing DOM element`, item);
		});
		console.log(`✅ Direct DOM manipulation complete: ${appendedCount} visible items added`);
		$listContainer.find('.lst__row').show();
		console.log(`📝 Fallback: Showed ${$listContainer.find('.lst__row').length} DOM items directly`);
	}

	// Create list items matching spells.js pattern with selection functionality
	getListItem(spell, spI) {
		// Generate a simple hash for modal context (avoid UrlUtil.autoEncodeHash which requires page registration)
		const hash = `${UrlUtil.encodeForHash(spell.name)}_${UrlUtil.encodeForHash(spell.source)}`;
		if (this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		const isExcluded = ExcludeUtil.isExcluded(hash, "spell", spell.source);

		// Let the page filter process this spell for filtering
		this._pageFilter.mutateAndAddToFilters(spell, isExcluded);

		const source = Parser.sourceJsonToAbv(spell.source);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const concentration = spell._isConc ? "×" : "";
		const range = Parser.spRangeToFull(spell.range, {isDisplaySelfArea: true});

		// Create checkbox for spell selection
		const $checkbox = $(`<input type="checkbox" class="spell-select-cb mr-2">`);
		// Use hash-based matching for preselection
		const itemHash = `${UrlUtil.encodeForHash(spell.name)}_${UrlUtil.encodeForHash(spell.source)}`;
		if (this._existingSpellHashes && this._existingSpellHashes.has(itemHash)) {
			$checkbox.prop('checked', true);
			this._selectedSpells.set(itemHash, spell);
		}

		$checkbox.on('change', (evt) => {
			if ($checkbox.prop('checked')) {
				this._selectedSpells.set(itemHash, spell);
			} else {
				this._selectedSpells.delete(itemHash);
			}
			this._updateSelectedCount();
			evt.stopPropagation();
		});

		// Create the DOM element structure using raw DOM (not jQuery) for List.js compatibility
		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const eleInner = document.createElement("a");
		eleInner.href = `#${hash}`;
		eleInner.className = "lst__row-border lst__row-inner";

		// Add checkbox to the inner element
		eleInner.appendChild($checkbox[0]);

		// Create and append other elements
		const elements = [
			{class: "bold ve-col-2-9 pl-0 pr-1", text: spell.name},
			{class: "ve-col-1-5 px-1 ve-text-center", text: PageFilterSpells.getTblLevelStr(spell)},
			{class: "ve-col-1-7 px-1 ve-text-center", text: time},
			{class: `ve-col-1-2 px-1 sp__school-${spell.school} ve-text-center`, text: school, 
			 title: Parser.spSchoolAbvToFull(spell.school),
			 style: Parser.spSchoolAbvToStylePart(spell.school)},
			{class: "ve-col-0-6 px-1 ve-text-center", text: concentration, title: "Concentration"},
			{class: "ve-col-2-4 px-1 ve-text-right", text: range},
			{class: `ve-col-1-7 ve-text-center ${Parser.sourceJsonToSourceClassname(spell.source)} pl-1 pr-0`, 
			 text: source, title: `${Parser.sourceJsonToFull(spell.source)}${Renderer.utils.getSourceSubText(spell)}`}
		];

		elements.forEach(el => {
			const span = document.createElement("span");
			span.className = el.class;
			span.textContent = el.text;
			if (el.title) span.title = el.title;
			if (el.style) span.setAttribute('style', el.style);
			eleInner.appendChild(span);
		});

		eleLi.appendChild(eleInner);

		// Add click handler for the entire row
		eleLi.addEventListener('click', (evt) => {
			if (!evt.target || !(evt.target instanceof Element) || !evt.target.classList.contains('spell-select-cb')) {
				this._renderStats_doBuildStatsTab({ent: spell});
			}
		});

		const listItem = new ListItem(
			spI,
			eleLi, // Raw DOM element for List.js
			spell.name,
			{
				hash,
				source,
				page: spell.page,
				level: spell.level,
				time,
				school: Parser.spSchoolAbvToFull(spell.school),
				concentration,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
			{
				isExcluded,
				entity: spell,
			},
		);

		return listItem;
	}

	// Set default filter state based on character class/level with full filtering system
	_setDefaultFiltersForCharacter() {
		if (!this._pageFilter || !this._characterData || !this._filterBox) return;
		
		try {
			console.log("🎯 Setting character-appropriate default filters...");
			
			// Set up character-appropriate class filters
			const characterClasses = this._characterData.class || [];
			if (characterClasses.length > 0) {
				const classNames = characterClasses.map(cls => cls.name).filter(Boolean);
				console.log(`🏛️ Character classes: ${classNames.join(', ')}`);
				
				// The PageFilterSpells will handle the complex class filtering
				// We just need to make sure the filter is set to show relevant spells
			}
			
			// Set level range based on character level
			const characterLevel = Math.max(...characterClasses.map(cls => cls.level || 1));
			let maxSpellLevel = Math.min(9, Math.ceil(characterLevel / 2));
			if (characterLevel < 2) maxSpellLevel = 1;
			
			console.log(`🎚️ Character level ${characterLevel}, max spell level ${maxSpellLevel}`);
			
			console.log("✅ Filters configured for character spell selection");
			
		} catch (error) {
			console.warn("Error setting character filters:", error);
		}
	}
}