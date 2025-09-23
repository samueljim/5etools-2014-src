
import {RenderCharacters} from "./render-characters.js";
// CharacterManager is available globally via character-manager.js script tag

class CharactersSublistManager extends SublistManager {
	static _getRowTemplate () {
		return [
			new SublistCellTemplate({
				name: "Name",
				css: "bold ve-col-5 pl-0 pr-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Class",
				css: "ve-col-3-8 px-1 ve-text-center",
				colStyle: "text-center",
			}),
			new SublistCellTemplate({
				name: "Race",
				css: "ve-col-1-2 px-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Level",
				css: "ve-col-2 pl-1 pr-0 ve-text-center",
				colStyle: "text-center",
			}),
		];
	}

	static _getRowCellsHtml ({values, templates = null}) {
		templates = templates || this._getRowTemplate();
		return values
			.map((val, i) => SublistCell.renderHtml({templates, cell: val, ix: i}))
			.join("");
	}

	pGetSublistItem (character, hash) {
		const cellsText = [
			character.name,
			character._fClass || "Unknown",
			character._fRace || "Unknown",
			character._fLevel || 0,
		];

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
				<a href="#${UrlUtil.autoEncodeHash(character)}" class="lst__row-border lst__row-inner">
					${CharactersSublistManager._getRowCellsHtml({values: cellsText})}
				</a>
			</div>
		`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			character.name,
			{
				hash,
				class: character._fClass || "Unknown",
				race: character._fRace || "Unknown",
				level: character._fLevel || 1,
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
		super({
			pageFilter: new PageFilterCharacters({
				sourceFilterOpts: {
					pFnOnChange: (...args) => this._pLoadSource(...args),
				},
			}),

			dataProps: ["character"],

			propLoader: "character", // Required by ListPageMultiSource, but we override loading

			pFnGetFluff: Renderer.character.pGetFluff.bind(Renderer.character),

			bookViewOptions: {
				namePlural: "characters",
				pageTitle: "Characters Book View",
			},
		});
	}

	// Override the default multi-source loading to use our blob storage instead
	async _pLoadAllSources () {
		// Characters are loaded from blob storage in _pOnLoad_pPreDataLoad
		// No need to load from static files
		return [];
	}

	// Override the entire data loading process to use CharacterManager with lazy loading
	async _pOnLoad_pGetData () {
		// Skip the traditional source-based loading entirely for characters
		// We handle character loading in _pOnLoad_pPreDataLoad via CharacterManager summaries
		return {};
	}

	// Override source loading since all characters come from API
	async _pLoadSource (src, nextFilterVal) {
		// Characters don't use traditional source loading
		// All characters are loaded from API regardless of source
	}

	getListItem (character, chI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(character, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const hash = UrlUtil.autoEncodeHash(character);
		const source = Parser.sourceJsonToAbv(character.source || "");
		const classText = character._fClass || "Unknown";
		const level = character._fLevel || 0;

		eleLi.innerHTML = `<a href="#${hash}" class="lst__row-border lst__row-inner">
			<span class="bold ve-col-4-2 pl-0">${character.name}</span>
			<span class="ve-col-1-7">${character._fRace || "Unknown"}</span>
			<span class="ve-col-4-1">${classText}</span>
			<span class="ve-col-1-7 ">${level}</span>
			<span class="ve-col-1 ${Parser.sourceJsonToSourceClassname(character.source || "")} pr-0" title="${Parser.sourceJsonToFull(character.source || "")}">${source}</span>
		</a>`;

		const listItem = new ListItem(
			chI,
			eleLi,
			character.name,
			{
				hash,
				source,
				race: character._fRace || "Unknown",
				class: classText,
				level: level,
			},
			{
				entity: character,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	async _pOnLoad_pPreDataLoad () {
		// Ensure Example source is loaded for hover/popout functionality
		await this._pLoadSource("Example", "yes");

		// Use lazy loading with character summaries for list display
		try {
			let summaries = await CharacterManager.loadCharacterSummaries();
			// Defensive: filter out any falsy/undefined entries that may have
			// accidentally been inserted into the cache.
			summaries = (summaries || []).filter(c => c);
			if (summaries.length > 0) {
				// Format for 5etools compatibility - summaries work like full characters for list display
				const formattedData = { character: summaries };
				this._addData(formattedData);
				console.log(`Loaded ${summaries.length} character summaries for list display`);
			} else {
				console.log("No character summaries found - this is normal for a fresh installation");
			}
		} catch (e) {
			console.warn("Failed to load character summaries:", e);
		}

		// Set up listener for character updates (handles both summaries and full characters)
		CharacterManager.addListener((characters) => {
			// Defensive: remove falsy entries
			characters = (characters || []).filter(c => c);
			// Update the list when characters change - summaries work for list display
			if (this._list) {
				// Get latest summaries for list display (more efficient than full characters)
				CharacterManager.loadCharacterSummaries().then(summaries => {
					if (summaries && summaries.length > 0) {
						const formattedData = { character: summaries.filter(c => c) };
						// Clear existing data and add fresh data
						this._dataList.length = 0;
						this._addData(formattedData);
						this._list.update();
					}
				}).catch(e => {
					console.warn("Failed to reload summaries for list update:", e);
					// Fallback to using the full character data provided
					const formattedData = { character: characters };
					this._dataList.length = 0;
					this._addData(formattedData);
					this._list.update();
				});
			}

			// Re-render currently displayed character if it was updated
			if (this._currentCharacter) {
				const characterId = CharacterManager._generateCompositeId(this._currentCharacter.name, this._currentCharacter.source);
				const updatedCharacter = characters.find(c => {
					const id = CharacterManager._generateCompositeId(c.name, c.source);
					return id === characterId;
				});

				if (updatedCharacter) {
					// Update the stored reference and re-render
					this._currentCharacter = updatedCharacter;

					// Update global character edit data for consistency
					if (globalThis._CHARACTER_EDIT_DATA) {
						globalThis._CHARACTER_EDIT_DATA[characterId] = updatedCharacter;
					}

					this._renderStats_doBuildStatsTab({ent: updatedCharacter});
				}
			}
		});


		// Listen for WebSocket character update events
		window.addEventListener('characterUpdated', (event) => {
			console.log('Character updated via WebSocket:', event.detail);
			const { character, characterId } = event.detail;
			
			if (this._currentCharacter) {
				const currentId = CharacterManager._generateCompositeId(this._currentCharacter.name, this._currentCharacter.source);
				if (currentId === characterId) {
					console.log('Refreshing currently displayed character from WebSocket update');
					// Update current character and re-render
					this._currentCharacter = character;
					this._renderStats_doBuildStatsTab({ent: character});
				}
			}
		});

		// Preload spell data so spell links work in character sheets
		try {
			await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_SPELLS);
		} catch (e) {
			console.warn("Failed to preload spell data for character page:", e);
		}
	}

	_processCharacterForDisplay (character) {
		// Add computed fields that the filters and display expect
		if (character.race) {
			character._fRace = character.race.variant ? `Variant ${character.race.name}` : character.race.name;
		}
		if (character.class && Array.isArray(character.class)) {
			// Create detailed class display with subclasses
			character._fClass = character.class.map(cls => {
				let classStr = cls.name;
				if (cls.subclass && cls.subclass.name) {
					classStr += ` (${cls.subclass.name})`;
				}
				return classStr;
			}).join("/");

			// Also create a simple class list for filtering/search
			character._fClassSimple = character.class.map(cls => cls.name).join("/");

			// Calculate total level from class levels
			character._fLevel = character.class.reduce((total, cls) => {
				return total + (cls.level || 0);
			}, 0);
		} else {
			character._fLevel = 1;
		}
		if (character.background) {
			character._fBackground = character.background.name;
		}
	}

	async loadCharacterById (characterId) {
		try {
			// Use CharacterManager's lazy loading mechanism
			const character = await CharacterManager.ensureFullCharacter(characterId);
			if (character) {
				return character;
			}
		} catch (e) {
			console.warn(`Failed to load character ${characterId}:`, e.message);
		}
		return null;
	}

	_doPreviewExpand ({listItem, dispExpandedOuter, btnToggleExpand, dispExpandedInner}) {
		super._doPreviewExpand({listItem, dispExpandedOuter, btnToggleExpand, dispExpandedInner});
		// Dice rolling is now handled by 5etools built-in system
	}

	_addData (data) {
		super._addData(data);

		// Also populate DataLoader cache for hover/popout functionality
		if (data.character && data.character.length) {
			DataLoader._pCache_addToCache({
				allDataMerged: data,
				propAllowlist: new Set(["character"]),
			});
		}
	}

	async _renderStats_doBuildStatsTab ({ent}) {
		// Check if this is a summary (has only basic fields) or a full character
		const isSummary = ent && !ent.class && !ent.race && !ent.background;
		
		if (isSummary) {
			// Show loading state while we fetch the full character
			this._$pgContent.empty().html(`
				<tr><th class="ve-tbl-border" colspan="6"></th></tr>
				<tr><td colspan="6" class="ve-text-center p-3">
					<i class="fas fa-spinner fa-spin"></i> Loading character details...
				</td></tr>
				<tr><th class="ve-tbl-border" colspan="6"></th></tr>
			`);

			try {
				// Lazy load the full character
				const fullCharacter = await CharacterManager.ensureFullCharacter(ent.id);
				if (!fullCharacter) {
					this._$pgContent.empty().html(`
						<tr><th class="ve-tbl-border" colspan="6"></th></tr>
						<tr><td colspan="6" class="ve-text-center p-3 text-danger">
							<i class="fas fa-exclamation-triangle"></i> Failed to load character details.
							${!navigator.onLine ? ' (You are offline - this character is not available)' : ''}
						</td></tr>
						<tr><th class="ve-tbl-border" colspan="6"></th></tr>
					`);
					return;
				}
				
				// Now render with the full character
				await this._renderStats_doBuildStatsTab({ent: fullCharacter});
				return;
			} catch (error) {
				console.warn(`Failed to load full character ${ent.id}:`, error);
				this._$pgContent.empty().html(`
					<tr><th class="ve-tbl-border" colspan="6"></th></tr>
					<tr><td colspan="6" class="ve-text-center p-3 text-danger">
						<i class="fas fa-exclamation-triangle"></i> Error loading character: ${error.message || 'Unknown error'}
					</td></tr>
					<tr><th class="ve-tbl-border" colspan="6"></th></tr>
				`);
				return;
			}
		}

		// We have a full character - render it
		const fn = Renderer.hover.getFnRenderCompact(UrlUtil.PG_CHARACTERS);
		const renderedContent = fn(ent);

		// Clear and populate the existing table directly
		this._$pgContent.empty().html(`
			<tr><th class="ve-tbl-border" colspan="6"></th></tr>
			<tr><td colspan="6">${renderedContent}</td></tr>
			<tr><th class="ve-tbl-border" colspan="6"></th></tr>
		`);

		// Bind listeners for interactive elements
		const fnBind = Renderer.hover.getFnBindListenersCompact(UrlUtil.PG_CHARACTERS);
		if (fnBind) fnBind(ent, this._$pgContent[0]);

		// Show Edit button and store current character
		this._currentCharacter = ent;
		const $editBtn = $("#btn-edit-character");
		if ($editBtn.length) {
			// Check if user has access to the character's source
			this._updateEditButtonVisibility(ent);
		}
	}

	async _updateEditButtonVisibility (character) {
		const $editBtn = $("#btn-edit-character");
		const $loginBtn = $("#btn-login-to-edit");
		const characterSource = character.source;

		if (!characterSource || characterSource === "Unknown" || characterSource === "") {
			// No source specified, hide edit button and show login button
			$editBtn.hide();
			$loginBtn.show();
			return;
		}

		// Check if user is authenticated and can edit this character
		const canEdit = this._canEditCharacter(character);

		if (canEdit) {
			// User has access, show edit button and hide login button
			$editBtn.show();
			$editBtn.attr("title", `Edit character from source: ${characterSource}`);
			if ($loginBtn.length) $loginBtn.hide();
		} else {
			// No access, hide edit button and show login button if it exists
			$editBtn.hide();
			if ($loginBtn.length) $loginBtn.show();
		}
	}

	_canEditCharacter (character) {
		try {
			// Check if user is authenticated with new system
			const sessionToken = localStorage.getItem('sessionToken');
			const currentUserData = localStorage.getItem('currentUser');
			
			if (sessionToken && currentUserData) {
				const currentUser = JSON.parse(currentUserData);
				const characterSource = character.source;
				
				// User can edit if character source matches their username
				// or for backward compatibility, if they're authenticated and source is reasonable
				if (characterSource === currentUser.username) {
					return true;
				}
				
				// For backward compatibility, allow editing if user is authenticated
				// and character has a valid source
				if (characterSource && characterSource !== "Unknown" && characterSource !== "") {
					return true;
				}
			}
			
			// Fallback: check old source-password system for backward compatibility
			const cachedPassword = this._getCachedPassword(character.source?.toLowerCase());
			return !!cachedPassword;
		} catch (e) {
			console.error("Error checking character edit permissions:", e);
			return false;
		}
	}

	_getCachedPassword (sourceName) {
		try {
			const stored = localStorage.getItem("sourcePasswords");
			const passwords = stored ? JSON.parse(stored) : {};
			return passwords[sourceName] || null;
		} catch (e) {
			console.error("Error loading cached passwords:", e);
			return null;
		}
	}

	async _pGetFluff (character) {
		return character.fluff || null;
	}

	async _pPreloadSublistSources (json) {
		if (json.l && json.l.items && json.l.sources) { // if it's an encounter file
			json.items = json.l.items;
			json.sources = json.l.sources;
		}
		const loaded = Object.keys(this._loadedSources)
			.filter(it => this._loadedSources[it].loaded);
		const lowerSources = json.sources?.map(it => it.toLowerCase()) || [];
		const toLoad = Object.keys(this._loadedSources)
			.filter(it => !loaded.includes(it))
			.filter(it => lowerSources.includes(it.toLowerCase()));
		const loadTotal = toLoad.length;
		if (loadTotal) {
			await Promise.all(toLoad.map(src => this._pLoadSource(src, "yes")));
		}
	}

	_getSearchCache (entity) {
		if (!entity._fSearch) {
			entity._fSearch = [
				entity.name,
				entity._fRace,
				entity._fClass,
				entity._fBackground,
				entity.customText || "",
			].join(" ").toLowerCase();
		}
		return entity._fSearch;
	}
}

const charactersPage = new CharactersPage();
charactersPage.sublistManager = new CharactersSublistManager();

// Expose globally for WebSocket character updates
window.charactersPage = charactersPage;
window.addEventListener("load", () => {
	charactersPage.pOnLoad();

	// Initialize Edit Character button
	$("#btn-edit-character").click(async () => {
		if (charactersPage._currentCharacter) {
			const character = charactersPage._currentCharacter;
			const characterSource = character.source;

			// Double-check access before allowing edit
			if (!charactersPage._canEditCharacter(character)) {
				// Check if user is authenticated at all
				const sessionToken = localStorage.getItem('sessionToken');
				if (!sessionToken) {
					alert("You need to be logged in to edit characters. Please visit the Login page to authenticate.");
				} else {
					alert(`You don't have permission to edit this character from source "${characterSource}".`);
				}
				return;
			}

			// Store character data for editor
			localStorage.setItem("editingCharacter", JSON.stringify(charactersPage._currentCharacter));

			// Navigate to character editor (data already stored in localStorage above)
			window.location.href = "charactereditor.html?edit=true";
		}
	});

	// Initialize Refresh Characters button
	$(document).on("click", "#btn-refresh-characters", async () => {
		try {
			// Indicate loading
			const $btn = $("#btn-refresh-characters");
			$btn.prop("disabled", true).addClass("ve-btn-loading");

			console.log(`🔄 FULL CACHE CLEAR: Clearing ALL character data from local storage`);
			
			// STEP 1: Clear ALL character caches completely
			try {
				// Clear CharacterManager's localStorage cache
				if (typeof CharacterManager._STORAGE_KEY !== 'undefined') {
					localStorage.removeItem(CharacterManager._STORAGE_KEY);
					console.log('✅ Cleared CharacterManager localStorage cache');
				}
				
				// Clear CharacterManager's summaries cache  
				if (typeof CharacterManager._SUMMARIES_STORAGE_KEY !== 'undefined') {
					localStorage.removeItem(CharacterManager._SUMMARIES_STORAGE_KEY);
					console.log('✅ Cleared CharacterManager summaries cache');
				}
				
				// Clear CharacterManager's memory caches
				if (typeof CharacterManager._characters !== 'undefined') {
					CharacterManager._characters.clear();
					console.log('✅ Cleared CharacterManager memory cache');
				}
				
				if (typeof CharacterManager._charactersArray !== 'undefined') {
					CharacterManager._charactersArray.length = 0;
					console.log('✅ Cleared CharacterManager array cache');
				}
				
				// Force clear summaries cache using CharacterManager method
				if (typeof CharacterManager._clearSummariesCache === 'function') {
					CharacterManager._clearSummariesCache();
					console.log('✅ Called CharacterManager._clearSummariesCache()');
				}
				
				// Clear any other character-related localStorage keys
				const keysToRemove = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && (key.includes('character') || key.includes('Character'))) {
						keysToRemove.push(key);
					}
				}
				keysToRemove.forEach(key => {
					localStorage.removeItem(key);
					console.log(`✅ Cleared additional character-related key: ${key}`);
				});
				
			} catch (clearError) {
				console.error('Error clearing caches:', clearError);
			}

			// STEP 2: If a character is currently displayed, refresh it from server
			if (charactersPage._currentCharacter) {
				const currentCharacterId = charactersPage._currentCharacter.id || 
					CharacterManager._generateCompositeId(charactersPage._currentCharacter.name, charactersPage._currentCharacter.source);
				
				console.log(`🔄 Refreshing currently displayed character: ${currentCharacterId}`);
				
				// Reload the character from server (cache is already cleared)
				try {
					const refreshedCharacter = await CharacterManager.ensureFullCharacter(currentCharacterId);
					if (refreshedCharacter) {
						// Update the current character reference
						charactersPage._currentCharacter = refreshedCharacter;
						
						// Re-render the character display
						charactersPage._renderStats_doBuildStatsTab({ent: refreshedCharacter});
						
						console.log(`✅ Successfully refreshed character: ${refreshedCharacter.name}`);
					} else {
						console.warn(`❌ Failed to refresh character: ${currentCharacterId}`);
					}
				} catch (refreshError) {
					console.error(`❌ Error refreshing current character:`, refreshError);
				}
			}
			
			// STEP 3: Force refresh summaries from server (cache is already cleared)
			const summaries = await CharacterManager.loadCharacterSummaries(null, true);

			// STEP 4: Rebuild the page data using the fresh summaries
			const filteredSummaries = (summaries || []).filter(c => c);
			const formattedData = { character: filteredSummaries };
			// Clear and add fresh data
			charactersPage._dataList.length = 0;
			charactersPage._addData(formattedData);
			if (charactersPage._list) charactersPage._list.update();

			console.log(`✅ COMPLETE REFRESH: Cleared all caches and loaded ${filteredSummaries.length} fresh character summaries`);
			if (charactersPage._currentCharacter) {
				console.log(`✅ Currently displayed character also refreshed from server`);
			}
			console.log(`🎉 All character data is now fresh from server!`);
		} catch (e) {
			console.warn("❌ Failed to refresh characters:", e);
		} finally {
			// Restore button state
			const $btn = $("#btn-refresh-characters");
			$btn.prop("disabled", false).removeClass("ve-btn-loading");
		}
	});
});

globalThis.dbg_page = charactersPage;
