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

		super({
			pageFilter,
			listOptions: {
				fnSort: PageFilterCharacters.sortCharacters,
			},
			dataProps: ["character"],
			brewDataSource: () => this._pGetBrewData(),
			
			propLoader: "character",
			listSyntax: new ListSyntaxCharacters({fnGetDataList: () => this._dataList}),
		});

		this._sublistManager = new CharactersSublistManager();
	}

	async _pGetBrewData () {
		console.log("_pGetBrewData called - starting character loading...");
		
		try {
			// For now, let's force default characters to always load
			const defaultCharacters = CharacterStorageUtil.getDefaultCharacters();
			console.log("Default characters created:", defaultCharacters.length);
			console.log("First character:", defaultCharacters[0]);
			
			const result = {character: defaultCharacters};
			console.log("Returning result:", result);
			
			// Update debug panel
			setTimeout(() => {
				const debugDiv = document.querySelector('div[style*="position: fixed"]');
				if (debugDiv) {
					debugDiv.innerHTML += `<br/>_pGetBrewData returned ${defaultCharacters.length} characters`;
				}
			}, 100);
			
			return result;
		} catch (error) {
			console.error("Error in _pGetBrewData:", error);
			
			// Update debug panel with error
			setTimeout(() => {
				const debugDiv = document.querySelector('div[style*="position: fixed"]');
				if (debugDiv) {
					debugDiv.innerHTML += `<br/><span style="color: red;">_pGetBrewData ERROR: ${error.message}</span>`;
				}
			}, 100);
			
			throw error;
		}
	}

	getListItem (character, chI) {
		console.log("getListItem called for character:", character.name, chI);
		
		const hash = UrlUtil.autoEncodeHash(character);
		if (this._seenHashes.has(hash)) {
			console.log("Character already seen, skipping:", character.name);
			return null;
		}
		this._seenHashes.add(hash);

		const isExcluded = ExcludeUtil.isExcluded(hash, "character", character.source);
		this._pageFilter.mutateAndAddToFilters(character, isExcluded);

		const source = Parser.sourceJsonToAbv(character.source || "HOMEBREW");
		const characterClass = character.class ? character.class.name : "Unknown";
		const level = character.level || 1;
		const race = character.race ? character.race.name : "Unknown";

		console.log("Creating DOM element for:", character.name);

		// Create elements using standard DOM methods for now
		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;
		
		const link = document.createElement("a");
		link.href = `#${hash}`;
		link.className = "lst__row-border lst__row-inner";
		
		// Create spans for each column
		const nameSpan = document.createElement("span");
		nameSpan.className = "bold ve-col-4-2 pl-0 pr-1";
		nameSpan.textContent = character.name;
		
		const classSpan = document.createElement("span");
		classSpan.className = "ve-col-3 px-1";
		classSpan.textContent = characterClass;
		
		const levelSpan = document.createElement("span");
		levelSpan.className = "ve-col-1-7 px-1 ve-text-center";
		levelSpan.textContent = level;
		
		const raceSpan = document.createElement("span");
		raceSpan.className = "ve-col-2-3 px-1";
		raceSpan.textContent = race;
		
		const sourceSpan = document.createElement("span");
		sourceSpan.className = `ve-grow ve-text-center ${Parser.sourceJsonToSourceClassname(character.source || "HOMEBREW")} pl-1 pr-0`;
		sourceSpan.title = Parser.sourceJsonToFull(character.source || "HOMEBREW");
		sourceSpan.textContent = source;
		
		// Append spans to link
		link.appendChild(nameSpan);
		link.appendChild(classSpan);
		link.appendChild(levelSpan);
		link.appendChild(raceSpan);
		link.appendChild(sourceSpan);
		
		// Append link to list item
		eleLi.appendChild(link);
		
		console.log("Created element:", eleLi);

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
			},
			{
				isExcluded,
				entity: character,
			},
		);

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderCharacters.$getRenderedCharacter(ent));
	}

	async _pOnLoad_pPreDataLoad () {
		// Initialize character creation button
		const $btnAddCharacter = $("#btn-add-character");
		if ($btnAddCharacter.length) {
			$btnAddCharacter.click(() => this._pHandleAddCharacter());
		}
	}

	async _pHandleAddCharacter () {
		// Create a randomized character automatically
		console.log("Creating new randomized character...");
		
		// Random character generation
		const names = [
			"Aerdrie", "Thalia", "Kael", "Lyra", "Gareth", "Seraphina", "Daven", "Mira", 
			"Thorin", "Elara", "Bram", "Zara", "Quinn", "Nova", "Rex", "Vera"
		];
		
		const classes = [
			{name: "Fighter", source: "PHB"},
			{name: "Wizard", source: "PHB"},
			{name: "Rogue", source: "PHB"},
			{name: "Cleric", source: "PHB"},
			{name: "Ranger", source: "PHB"},
			{name: "Barbarian", source: "PHB"},
			{name: "Bard", source: "PHB"},
			{name: "Paladin", source: "PHB"}
		];
		
		const races = [
			{name: "Human", source: "PHB"},
			{name: "Elf", source: "PHB"},
			{name: "Dwarf", source: "PHB"},
			{name: "Halfling", source: "PHB"},
			{name: "Dragonborn", source: "PHB"},
			{name: "Gnome", source: "PHB"},
			{name: "Half-Elf", source: "PHB"},
			{name: "Tiefling", source: "PHB"}
		];
		
		const backgrounds = [
			{name: "Acolyte", source: "PHB"},
			{name: "Criminal", source: "PHB"},
			{name: "Folk Hero", source: "PHB"},
			{name: "Noble", source: "PHB"},
			{name: "Sage", source: "PHB"},
			{name: "Soldier", source: "PHB"}
		];
		
		// Random selection
		const randomName = names[Math.floor(Math.random() * names.length)];
		const randomClass = classes[Math.floor(Math.random() * classes.length)];
		const randomRace = races[Math.floor(Math.random() * races.length)];
		const randomBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];
		const randomLevel = Math.floor(Math.random() * 10) + 1; // Level 1-10
		
		// Generate random ability scores (4d6 drop lowest method)
		const rollAbilityScore = () => {
			const rolls = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1);
			rolls.sort((a, b) => b - a);
			return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
		};
		
		const newCharacter = CharacterUtil.createNewCharacter({
			name: randomName,
			level: randomLevel,
			class: randomClass,
			race: randomRace,
			background: randomBackground,
			abilityScores: {
				str: rollAbilityScore(),
				dex: rollAbilityScore(),
				con: rollAbilityScore(),
				int: rollAbilityScore(),
				wis: rollAbilityScore(),
				cha: rollAbilityScore()
			}
		});

		console.log("Created new character:", newCharacter);

		// Save the character
		try {
			const characters = await CharacterStorageUtil.pLoadCharacters();
			characters.push(newCharacter);
			await CharacterStorageUtil.pSaveCharacters(characters);
			
			console.log("Character saved successfully!");
			
			// Refresh the page to show the new character
			window.location.reload();
		} catch (error) {
			console.error("Failed to save character:", error);
			alert("Failed to save character. Please try again.");
		}
	}
}

// Simple ListSyntax for characters
class ListSyntaxCharacters {
	constructor ({fnGetDataList}) {
		this._fnGetDataList = fnGetDataList;
	}

	build () {
		// Build search index for characters
		const searchCache = [];
		const dataList = this._fnGetDataList();
		
		dataList.forEach((character, index) => {
			const cache = this._getSearchCache(character);
			searchCache.push({
				c: cache,
				i: index
			});
		});
		
		return searchCache;
	}

	_getSearchCache (entity) {
		const parts = [
			entity.name,
			entity.source,
			entity.class?.name,
			entity.race?.name,
			entity.background?.name
		].filter(Boolean);
		return parts.join(" ").toLowerCase();
	}
}

const charactersPage = new CharactersPage();
charactersPage.sublistManager = new CharactersSublistManager();

window.addEventListener("load", () => {
	console.log("Characters page loading...");
	alert("JavaScript is working! Check the page for debug panel and test character.");
	
	// Add debug info panel
	setTimeout(() => {
		const debugDiv = document.createElement("div");
		debugDiv.style.cssText = "position: fixed; top: 10px; right: 10px; background: #000; color: #0f0; padding: 10px; font-family: monospace; font-size: 12px; z-index: 9999; border: 1px solid #0f0; max-width: 300px;";
		debugDiv.innerHTML = `
			<strong>DEBUG INFO:</strong><br/>
			Page loaded: ${new Date().toLocaleTimeString()}<br/>
			List element exists: ${!!document.getElementById("list")}<br/>
			Listcontainer exists: ${!!document.getElementById("listcontainer")}<br/>
			CharacterStorageUtil: ${typeof CharacterStorageUtil !== 'undefined'}<br/>
			ListSyntaxCharacters: ${typeof ListSyntaxCharacters !== 'undefined'}<br/>
			CharactersPage: ${typeof CharactersPage !== 'undefined'}<br/>
		`;
		document.body.appendChild(debugDiv);
	}, 500);
	
	// Test character addition
	setTimeout(() => {
		console.log("Adding test character to DOM...");
		const listElement = document.getElementById('list');
		if (listElement) {
			console.log("Found list element, adding test character...");
			const testCharDiv = document.createElement('div');
			testCharDiv.className = 'lst__row ve-flex-col';
			testCharDiv.style.cssText = "background: yellow; border: 2px solid red; margin: 5px;";
			testCharDiv.innerHTML = `
				<a href="#test" class="lst__row-border lst__row-inner">
					<span class="bold ve-col-4-2 pl-0 pr-1">TEST CHARACTER</span>
					<span class="ve-col-3 px-1">Fighter</span>
					<span class="ve-col-1-7 px-1 ve-text-center">5</span>
					<span class="ve-col-2-3 px-1">Human</span>
					<span class="ve-grow ve-text-center pl-1 pr-0">HB</span>
				</a>
			`;
			listElement.appendChild(testCharDiv);
			console.log("Test character added to DOM");
		} else {
			console.log("List element not found!");
		}
	}, 1000);
	
	charactersPage.pOnLoad().then(() => {
		console.log("Characters page loaded successfully!");
		
		// Update debug info after page load
		setTimeout(() => {
			const debugDiv = document.querySelector('div[style*="position: fixed"]');
			if (debugDiv) {
				debugDiv.innerHTML += `<br/>Page loaded successfully!<br/>Characters in list: ${document.querySelectorAll('#list .lst__row').length}`;
			}
		}, 1000);
	}).catch(error => {
		console.error("Error loading characters page:", error);
		
		// Update debug info with error
		setTimeout(() => {
			const debugDiv = document.querySelector('div[style*="position: fixed"]');
			if (debugDiv) {
				debugDiv.innerHTML += `<br/><span style="color: red;">ERROR: ${error.message}</span>`;
			}
		}, 1000);
	});
});
