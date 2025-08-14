class PageFilterCharacters extends PageFilter {
	constructor () {
		super();

		this._levelFilter = new Filter({
			header: "Level",
			items: [...new Array(20)].map((_, i) => i + 1),
			displayFn: (level) => `${level}`,
		});

		this._classFilter = new Filter({
			header: "Class",
		});

		this._raceFilter = new Filter({
			header: "Race",
		});

		this._sourceFilter = new Filter({
			header: "Source",
			items: ["HOMEBREW"],
			deselFn: (it) => it === "HOMEBREW",
		});
	}

	static mutateForFilters (character) {
		character._fLevel = character.level || 1;
		character._fClass = character.class ? character.class.name : "Unknown";
		character._fRace = character.race ? character.race.name : "Unknown";
		character._fSource = character.source || "HOMEBREW";
	}

	addToFilters (character, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(character._fSource);
		this._levelFilter.addItem(character._fLevel);
		this._classFilter.addItem(character._fClass);
		this._raceFilter.addItem(character._fRace);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._levelFilter,
			this._classFilter,
			this._raceFilter,
		];
	}

	toDisplay (values, character) {
		return this._filterBox.toDisplay(
			values,
			character._fSource,
			character._fLevel,
			character._fClass,
			character._fRace,
		);
	}

	static sortCharacters (a, b, o) {
		switch (o.sortBy) {
			case "name": return SortUtil.ascSort(a.name, b.name) || SortUtil.ascSort(a.source, b.source);
			case "class": return SortUtil.ascSort(a._fClass, b._fClass) || SortUtil.ascSort(a.name, b.name);
			case "level": return SortUtil.ascSort(a._fLevel, b._fLevel) || SortUtil.ascSort(a.name, b.name);
			case "race": return SortUtil.ascSort(a._fRace, b._fRace) || SortUtil.ascSort(a.name, b.name);
			case "source": return SortUtil.ascSort(a.source, b.source) || SortUtil.ascSort(a.name, b.name);
			default: return 0;
		}
	}
}
