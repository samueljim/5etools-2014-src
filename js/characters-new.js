class CharactersSublistManager extends SublistManager {
	static _getRowTemplate () {
		return [
			new SublistCellTemplate({
				name: "Name",
				css: "bold ve-col-4 pl-0 pr-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Class",
				css: "ve-col-3 px-1",
				colStyle: "",
			}),
			new SublistCellTemplate({
				name: "Level",
				css: "ve-col-2 ve-text-center px-1",
				colStyle: "text-center",
			}),
			new SublistCellTemplate({
				name: "Race",
				css: "ve-col-3 pl-1 pr-0",
				colStyle: "",
			}),
		];
	}

	pGetSublistItem (character, hash) {
		const cellsText = [
			character.name,
			character.class ? character.class.name : "Unknown",
			character.level || 1,
			character.race ? character.race.name : "Unknown",
		];

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
				<a href="#${hash}" class="lst__row-border lst__row-inner">
					<div class="bold ve-col-4 pl-0 pr-1">${cellsText[0]}</div>
					<div class="ve-col-3 px-1">${cellsText[1]}</div>
					<div class="ve-col-2 ve-text-center px-1">${cellsText[2]}</div>
					<div class="ve-col-3 pl-1 pr-0">${cellsText[3]}</div>
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
				source: character.source || "HOMEBREW",
				level: character.level || 1,
				class: character.class ? character.class.name : "Unknown",
				race: character.race ? character.race.name : "Unknown",
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
		super({
			dataSource: () => {
				// Return hardcoded characters that work like races
				const testCharacters = [
					{
						name: "Aragorn",
						class: {name: "Ranger", source: "PHB"},
						level: 5,
						race: {name: "Human", source: "PHB"},
						source: "HOMEBREW",
						abilityScores: {
							strength: 16,
							dexterity: 14,
							constitution: 13,
							intelligence: 12,
							wisdom: 15,
							charisma: 10
						},
						hitPoints: 45,
						armorClass: 15,
						equipment: ["Longsword", "Bow", "Leather Armor"],
						background: {name: "Folk Hero"}
					},
					{
						name: "Legolas",
						class: {name: "Fighter", source: "PHB"},
						level: 7,
						race: {name: "Elf", source: "PHB"},
						source: "HOMEBREW",
						abilityScores: {
							strength: 12,
							dexterity: 18,
							constitution: 14,
							intelligence: 13,
							wisdom: 16,
							charisma: 11
						},
						hitPoints: 58,
						armorClass: 16,
						equipment: ["Elven Bow", "Twin Daggers", "Studded Leather"],
						background: {name: "Noble"}
					},
					{
						name: "Gandalf",
						class: {name: "Wizard", source: "PHB"},
						level: 10,
						race: {name: "Human", source: "PHB"},
						source: "HOMEBREW",
						abilityScores: {
							strength: 10,
							dexterity: 12,
							constitution: 14,
							intelligence: 18,
							wisdom: 16,
							charisma: 14
						},
						hitPoints: 70,
						armorClass: 12,
						equipment: ["Staff", "Spellbook", "Robes"],
						background: {name: "Sage"},
						spells: ["Fireball", "Magic Missile", "Shield"]
					}
				];
				
				console.log("Returning test characters:", testCharacters);
				return Promise.resolve({character: testCharacters});
			},

			pageFilter,
			dataProps: ["character"],
			hasAudio: false,
		});
	}

	getListItem (character, chI, isExcluded) {
		// Create hash exactly like races do
		const hash = `${character.name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${character.source || "HOMEBREW"}`;
		
		if (this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		this._pageFilter.mutateAndAddToFilters(character, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(character.source || "HOMEBREW");

		eleLi.innerHTML = `<a href="#${hash}" class="lst__row-border lst__row-inner">
			<span class="bold ve-col-4 pl-0 pr-1">${character.name}</span>
			<span class="ve-col-3 px-1">${character.class ? character.class.name : "Unknown"}</span>
			<span class="ve-col-2 ve-text-center px-1">${character.level || 1}</span>
			<span class="ve-col-3 pl-1 pr-0">${character.race ? character.race.name : "Unknown"}</span>
		</a>`;

		const listItem = new ListItem(
			chI,
			eleLi,
			character.name,
			{
				hash,
				source,
				level: character.level || 1,
				class: character.class ? character.class.name : "Unknown",
				race: character.race ? character.race.name : "Unknown",
			},
			{
				isExcluded,
				entity: character,
			},
		);

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent: character}) {
		this._$pgContent.empty().append(RenderCharacters.$getRenderedCharacter(character));
	}
}

const charactersPage = new CharactersPage();
charactersPage.sublistManager = new CharactersSublistManager();

window.addEventListener("load", () => {
	console.log("Characters page script loaded");
	charactersPage.pOnLoad().catch(error => {
		console.error("Error loading characters page:", error);
	});
});
