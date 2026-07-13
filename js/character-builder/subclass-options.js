"use strict";

/**
 * Subclass timing + option persistence (e.g. Warlock Genie kind → subSubclass).
 */
(function (global) {
	/** Fallback PHB/TCE subclass gain levels when class JSON is unavailable. */
	const SUBCLASS_LEVELS = {
		Artificer: 3,
		Barbarian: 3,
		Bard: 3,
		Cleric: 1,
		Druid: 2,
		Fighter: 3,
		Monk: 3,
		Paladin: 3,
		Ranger: 3,
		Rogue: 3,
		Sorcerer: 1,
		Warlock: 1,
		Wizard: 2,
	};

	/** Known subclass option tables that map to character.class[].subclass.subSubclass */
	const SUBCLASS_OPTION_DEFS = [
		{
			id: "warlock-genie-kind",
			matchFeature: (name) => /the\s*genie/i.test(name || ""),
			matchSubclass: (sc) => /genie/i.test(sc?.shortName || sc?.name || ""),
			className: "Warlock",
			options: [
				{value: "Dao", label: "Dao (Earth)"},
				{value: "Djinni", label: "Djinni (Air)"},
				{value: "Efreeti", label: "Efreeti (Fire)"},
				{value: "Marid", label: "Marid (Water)"},
			],
			title: "Genie Kind",
			prompt: "Choose your genie patron's kind. This determines your expanded spell list.",
		},
	];

	function getSubclassLevel (className, classData) {
		if (classData?.class?.[0]?.classFeatures) {
			const features = classData.class[0].classFeatures;
			for (let i = 0; i < features.length; i++) {
				const lvl = i + 1;
				const levelFeatures = features[i];
				const arr = Array.isArray(levelFeatures) ? levelFeatures : [levelFeatures];
				for (const feat of arr) {
					const str = typeof feat === "string" ? feat : feat?.classFeature || "";
					if (/gainSubclassFeature/i.test(JSON.stringify(feat)) || /archetype|path|circle|college|domain|oath|origin|patron|tradition|specialty/i.test(str)) {
						// Prefer explicit gainSubclassFeature object form
						if (typeof feat === "object" && feat.gainSubclassFeature) return lvl;
					}
					if (typeof feat === "object" && feat.gainSubclassFeature) return lvl;
				}
			}
		}
		return SUBCLASS_LEVELS[className] || null;
	}

	function findSubclassOptionDef ({featureName, subclass}) {
		return SUBCLASS_OPTION_DEFS.find(def => {
			if (def.matchFeature(featureName)) return true;
			if (subclass && def.matchSubclass(subclass)) return true;
			return false;
		}) || null;
	}

	function applySubSubclass (character, {className, subSubclass}) {
		if (!character?.class || !subSubclass) return false;
		const entry = character.class.find(c => (c.name || "").toLowerCase() === (className || "").toLowerCase())
			|| character.class[0];
		if (!entry) return false;
		if (!entry.subclass) entry.subclass = {};
		entry.subclass.subSubclass = subSubclass;
		return true;
	}

	function needsSubclassSelection (classEntry, classData) {
		if (!classEntry) return false;
		if (classEntry.subclass?.name || classEntry.subclass?.shortName) return false;
		const required = getSubclassLevel(classEntry.name, classData);
		if (!required) return false;
		return (classEntry.level || 1) >= required;
	}

	function shouldOfferSubclassAtLevel (className, newLevel, classData) {
		const required = getSubclassLevel(className, classData);
		return required != null && newLevel === required;
	}

	function extractSubSubclassOptionsFromClassJson (subclassJson) {
		if (!subclassJson?.additionalSpells) return null;
		const named = subclassJson.additionalSpells
			.filter(block => block?.name && block.expanded)
			.map(block => ({value: block.name, label: block.name}));
		return named.length ? named : null;
	}

	global.CharacterBuilderSubclassOptions = {
		SUBCLASS_LEVELS,
		SUBCLASS_OPTION_DEFS,
		getSubclassLevel,
		findSubclassOptionDef,
		applySubSubclass,
		needsSubclassSelection,
		shouldOfferSubclassAtLevel,
		extractSubSubclassOptionsFromClassJson,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
