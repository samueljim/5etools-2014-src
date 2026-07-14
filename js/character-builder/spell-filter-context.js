"use strict";

/**
 * Build PageFilterSpells default values from character JSON.
 * Attached to globalThis for classic script loading.
 */
(function (global) {
	const FULL_CASTERS = new Set(["Bard", "Cleric", "Druid", "Sorcerer", "Wizard", "Warlock"]);
	const HALF_CASTERS = new Set(["Paladin", "Ranger"]);
	// Artificer handled separately (half caster, round up)

	function getAbilityScore (character, ab) {
		if (character?.abilities?.[ab] != null) return character.abilities[ab];
		if (character?.[ab] != null) return character[ab];
		return 10;
	}

	function getMaxSpellLevelForClass (cls) {
		const name = cls?.name || "";
		const lvl = cls?.level || 1;
		const subclassName = cls?.subclass?.name || cls?.subclass?.shortName || "";

		if (name === "Artificer") {
			const casterLvl = Math.ceil(lvl / 2);
			const slots = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5];
			return Math.min(5, slots[Math.min(20, casterLvl)] || 1);
		}
		if (FULL_CASTERS.has(name)) return Math.min(9, Math.max(1, lvl));
		if (HALF_CASTERS.has(name)) return Math.min(5, Math.max(1, Math.floor(lvl / 2)));
		if (name === "Fighter" && /eldritch\s*knight/i.test(subclassName)) return Math.min(4, Math.max(1, Math.floor(lvl / 3)));
		if (name === "Rogue" && /arcane\s*trickster/i.test(subclassName)) return Math.min(4, Math.max(1, Math.floor(lvl / 3)));
		return 0;
	}

	function buildSpellFilterContext (character) {
		const values = {};
		if (!character) return values;

		const characterClasses = character.class || [];
		const levelsAllowed = new Set([0]);

		if (character.spells?.levels && Object.keys(character.spells.levels).length) {
			Object.keys(character.spells.levels).forEach(k => {
				const lvl = Number.parseInt(k, 10);
				if (!Number.isNaN(lvl)) levelsAllowed.add(lvl);
			});
		} else {
			characterClasses.forEach(cls => {
				const maxForClass = getMaxSpellLevelForClass(cls);
				for (let L = 0; L <= maxForClass; ++L) levelsAllowed.add(L);
			});
		}

		values.Level = {};
		[...levelsAllowed].sort((a, b) => a - b).forEach(l => { values.Level[l] = 1; });

		const classesFilterValues = {};
		const subclassFilterValues = {};

		characterClasses.forEach(cls => {
			if (!cls?.name || typeof PageFilterSpells === "undefined") return;
			const classSource = cls.source || Parser.SRC_PHB;

			try {
				const classFi = PageFilterSpells._getClassFilterItem({
					className: cls.name,
					classSource,
					isVariantClass: false,
					definedInSource: classSource,
				});
				if (classFi?.item) {
					classesFilterValues[classFi.item] = 1;
					subclassFilterValues[classFi.item] = 1;
				}
			} catch (e) { /* ignore */ }

			const sc = cls.subclass;
			if (sc && (sc.name || sc.shortName)) {
				const subclassSource = sc.source || classSource;
				const subclassShort = sc.shortName || sc.name;
				const subclassName = sc.name || sc.shortName;
				try {
					const addSubclassValue = (subSubclassName) => {
						const fi = PageFilterSpells._getSubclassFilterItem({
							className: cls.name,
							classSource,
							subclassShortName: subclassShort,
							subclassName,
							subclassSource,
							subSubclassName,
							isVariantClass: false,
							definedInSource: subclassSource,
						});
						if (fi?.item) subclassFilterValues[fi.item] = 1;
					};

					// Base subclass (e.g. "Warlock: Genie") — matches spells shared across all kinds.
					addSubclassValue(undefined);

					// Sub-subclass "kinds" (e.g. Genie → Marid). A character can have more than one
					// (e.g. a shared base plus a kind), so support a string, array, or comma list and
					// add a filter value for each so the kind-specific spells are allowed too.
					const rawKinds = sc.subSubclass;
					const kinds = (Array.isArray(rawKinds) ? rawKinds : (typeof rawKinds === "string" ? rawKinds.split(",") : []))
						.map(k => String(k ?? "").trim())
						.filter(Boolean);
					[...new Set(kinds)].forEach(kind => addSubclassValue(kind));
				} catch (e) { /* ignore */ }
			}
		});

		if (Object.keys(classesFilterValues).length) {
			values.Classes = classesFilterValues;
			values.Class = classesFilterValues;
		}
		if (Object.keys(subclassFilterValues).length) {
			values.Subclass = subclassFilterValues;
		}

		// Race filter (racial spell lists)
		const race = character.race;
		if (race?.name && typeof PageFilterSpells !== "undefined") {
			try {
				const raceFi = PageFilterSpells.getRaceFilterItem({
					name: race.name,
					source: race.source || Parser.SRC_PHB,
					baseName: race._baseName || race.baseName,
				});
				if (raceFi?.item) {
					values.Race = { [raceFi.item]: 1 };
				}
			} catch (e) { /* ignore */ }
		}

		return values;
	}

	global.CharacterBuilderSpellFilterContext = {
		buildSpellFilterContext,
		getMaxSpellLevelForClass,
		getAbilityScore,
		FULL_CASTERS,
		HALF_CASTERS,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
