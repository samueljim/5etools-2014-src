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

class CharactersPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterCharacters();
		const pFnGetFluff = null; // Characters don't have fluff data

		super({
			dataSource: null, // Characters are loaded from homebrew
			dataSourceFluff: null,
			pFnGetFluff,
			pageFilter,
			listClass: "characters",
			dataProps: ["character"],
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
				},
				filter: {generator: pageFilter},
			},
		});

		this._sublistManager = new CharactersSublistManager();
	}

	getListItem (character, chI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(character, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = "lst__row ve-flex-col";

		const hash = UrlUtil.autoEncodeHash(character);
		const source = character.source || "HOMEBREW";
		const characterClass = character.class ? character.class.name : "Unknown";
		const level = character.level || 1;
		const race = character.race ? character.race.name : "Unknown";

		eleLi.innerHTML = `<a href="#${hash}" class="lst__row-border lst__row-inner">
			<span class="bold ve-col-4-2 pl-0">${character.name}</span>
			<span class="ve-col-3 px-1">${characterClass}</span>
			<span class="ve-col-1-7 px-1 ve-text-center">${level}</span>
			<span class="ve-col-2-3 pr-0">${race}</span>
		</a>`;

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
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderCharacters.$getRenderedCharacter(ent));
	}

	async _pOnLoad_pPreDataLoad () {
		// Load homebrew character data
		await BrewUtil2.pAddBrewData();

		// Load character data from homebrew storage
		const brewData = await BrewUtil2.pGetBrewProcessed();
		this._dataList = brewData?.character || [];

		// Initialize character creation button
		document.getElementById("btn-add-character").addEventListener("click", () => {
			this._pHandleAddCharacter();
		});
	}

	async _pHandleAddCharacter () {
		// Placeholder for character creation - will be implemented in later tasks
		JqueryUtil.doToast({
			content: "Character creation will be implemented in a future update.",
			type: "info",
		});
	}

	async pDoLoadHash (id) {
		const character = this._dataList[id];
		if (!character) return;

		await this._pOnLoad_pLoadSubHash([]);
		this._renderStats_doBuildStatsTab({ent: character});
	}

	async _pOnLoad_pLoadSubHash (sub) {
		// Handle subhashes if needed
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

// Initialize the page
const charactersPage = new CharactersPage();
window.addEventListener("load", () => charactersPage.pOnLoad());
