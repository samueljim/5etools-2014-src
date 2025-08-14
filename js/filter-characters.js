class PageFilterCharacters extends PageFilterBase {
	constructor () {
		super();

		this._levelFilter = new RangeFilter({
			header: "Level",
			min: 1,
			max: 20,
		});

		this._classFilter = new Filter({
			header: "Class",
			displayFn: StrUtil.toTitleCase,
		});

		this._raceFilter = new Filter({
			header: "Race",
			displayFn: StrUtil.toTitleCase,
		});

		this._backgroundFilter = new Filter({
			header: "Background",
			displayFn: StrUtil.toTitleCase,
		});

		this._miscFilter = new Filter({
			header: "Miscellaneous",
			items: ["Has Custom Notes", "Has Custom Features", "Spellcaster"],
			displayFn: StrUtil.toTitleCase,
			deselFn: PageFilterBase.defaultMiscellaneousDeselFn,
			isMiscFilter: true,
		});
	}

	static mutateForFilters (character) {
		// Common source filtering
		PageFilterBase._mutateForFilters_commonSources(character);

		// Character-specific filters
		character._fLevel = character.level || 1;
		character._fClass = character.class ? character.class.name : "Unknown";
		character._fRace = character.race ? character.race.name : "Unknown";
		character._fBackground = character.background ? character.background.name : "Unknown";

		// Miscellaneous filters
		PageFilterBase._mutateForFilters_commonMisc(character);
		if (character.customNotes && character.customNotes.trim()) character._fMisc.push("Has Custom Notes");
		if (character.customFeatures && character.customFeatures.length) character._fMisc.push("Has Custom Features");
		if (character.spellcasting && (character.spellcasting.known?.length || character.spellcasting.prepared?.length)) character._fMisc.push("Spellcaster");
	}

	addToFilters (character, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(character._fSources);
		this._levelFilter.addItem(character._fLevel);
		this._classFilter.addItem(character._fClass);
		this._raceFilter.addItem(character._fRace);
		this._backgroundFilter.addItem(character._fBackground);
		this._miscFilter.addItem(character._fMisc);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._levelFilter,
			this._classFilter,
			this._raceFilter,
			this._backgroundFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, character) {
		return this._filterBox.toDisplay(
			values,
			character._fSources,
			character._fLevel,
			character._fClass,
			character._fRace,
			character._fBackground,
			character._fMisc,
		);
	}

	static sortCharacters (a, b, o) {
		switch (o.sortBy) {
			case "name": return SortUtil.compareListNames(a, b);
			case "class": return SortUtil.ascSort(a.values.class, b.values.class) || SortUtil.compareListNames(a, b);
			case "level": return SortUtil.ascSort(a.values.level, b.values.level) || SortUtil.compareListNames(a, b);
			case "race": return SortUtil.ascSort(a.values.race, b.values.race) || SortUtil.compareListNames(a, b);
			case "source": return SortUtil.ascSort(a.values.source, b.values.source) || SortUtil.compareListNames(a, b);
			default: return SortUtil.listSort(a, b, o);
		}
	}
}
