"use strict";

/**
 * Shared level-up helpers: class discovery, multiclass prereqs, caster slot tables.
 */
(function (global) {
	const PRIMARY_CLASS_FILES = [
		"artificer", "barbarian", "bard", "cleric", "druid", "fighter",
		"monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
	];

	/** Exclude from default picker unless explicitly enabled */
	const OPTIONAL_CLASS_FILES = ["mystic", "sidekick"];

	const MULTICLASS_REQUIREMENTS = {
		Artificer: {int: 13},
		Barbarian: {str: 13},
		Bard: {cha: 13},
		Cleric: {wis: 13},
		Druid: {wis: 13},
		Fighter: {or: [{str: 13}, {dex: 13}]},
		Monk: {dex: 13, wis: 13},
		Paladin: {str: 13, cha: 13},
		Ranger: {dex: 13, wis: 13},
		Rogue: {dex: 13},
		Sorcerer: {cha: 13},
		Warlock: {cha: 13},
		Wizard: {int: 13},
	};

	function getAbilityScore (character, ab) {
		if (character?.abilities?.[ab] != null) return Number(character.abilities[ab]);
		if (character?.[ab] != null) return Number(character[ab]);
		return 10;
	}

	function getAbilitiesMap (character) {
		return {
			str: getAbilityScore(character, "str"),
			dex: getAbilityScore(character, "dex"),
			con: getAbilityScore(character, "con"),
			int: getAbilityScore(character, "int"),
			wis: getAbilityScore(character, "wis"),
			cha: getAbilityScore(character, "cha"),
		};
	}

	function checkMulticlassRequirements (character, targetClassName) {
		const req = MULTICLASS_REQUIREMENTS[targetClassName];
		if (!req) return {eligible: true, reason: ""};
		const abs = getAbilitiesMap(character);

		if (req.or) {
			const ok = req.or.some(opt => Object.entries(opt).every(([ab, min]) => abs[ab] >= min));
			if (!ok) {
				return {eligible: false, reason: `${targetClassName} requires ${req.or.map(o => Object.entries(o).map(([a, m]) => `${a.toUpperCase()} ${m}+`).join("")).join(" OR ")}`};
			}
			return {eligible: true, reason: ""};
		}

		for (const [ab, min] of Object.entries(req)) {
			if (abs[ab] < min) {
				return {eligible: false, reason: `${targetClassName} requires ${ab.toUpperCase()} ${min}+ (have ${abs[ab]})`};
			}
		}
		return {eligible: true, reason: ""};
	}

	/** Full caster slot table by character caster level 1–20 → [L1..L9] */
	const FULL_CASTER_SLOTS = [
		[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
		[4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
		[4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
	];
	const HALF_CASTER_SLOTS = [
		[], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
		[4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
	];
	const THIRD_CASTER_SLOTS = [
		[], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3],
		[4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
	];
	/** Warlock pact slots: level → {slots, slotLevel} */
	const WARLOCK_PACT = [
		{slots: 1, slotLevel: 1}, {slots: 2, slotLevel: 1}, {slots: 2, slotLevel: 2}, {slots: 2, slotLevel: 2},
		{slots: 2, slotLevel: 3}, {slots: 2, slotLevel: 3}, {slots: 2, slotLevel: 4}, {slots: 2, slotLevel: 4},
		{slots: 2, slotLevel: 5}, {slots: 2, slotLevel: 5}, {slots: 3, slotLevel: 5}, {slots: 3, slotLevel: 5},
		{slots: 3, slotLevel: 5}, {slots: 3, slotLevel: 5}, {slots: 3, slotLevel: 5}, {slots: 3, slotLevel: 5},
		{slots: 4, slotLevel: 5}, {slots: 4, slotLevel: 5}, {slots: 4, slotLevel: 5}, {slots: 4, slotLevel: 5},
	];

	function getCasterLevelContribution (cls) {
		const name = cls.name;
		const level = cls.level || 1;
		const sc = cls.subclass?.name || cls.subclass?.shortName || "";
		if (name === "Warlock") return {type: "pact", level};
		if (["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(name)) return {type: "full", level};
		if (name === "Artificer") return {type: "halfRoundUp", level};
		if (["Paladin", "Ranger"].includes(name)) return {type: "half", level};
		if (name === "Fighter" && /eldritch\s*knight/i.test(sc) && level >= 3) return {type: "third", level};
		if (name === "Rogue" && /arcane\s*trickster/i.test(sc) && level >= 3) return {type: "third", level};
		return {type: "none", level: 0};
	}

	function computeSpellSlots (character) {
		let full = 0;
		let half = 0;
		let third = 0;
		let pact = null;

		(character.class || []).forEach(cls => {
			const contrib = getCasterLevelContribution(cls);
			if (contrib.type === "full") full += contrib.level;
			else if (contrib.type === "half") half += Math.floor(contrib.level / 2);
			else if (contrib.type === "halfRoundUp") half += Math.ceil(contrib.level / 2);
			else if (contrib.type === "third") third += Math.floor(contrib.level / 3);
			else if (contrib.type === "pact") pact = WARLOCK_PACT[Math.min(20, contrib.level) - 1];
		});

		const casterLevel = Math.min(20, full + half + third);
		const slotsArr = casterLevel > 0 ? (FULL_CASTER_SLOTS[casterLevel - 1] || []) : [];
		const slots = {};
		slotsArr.forEach((n, i) => { slots[String(i + 1)] = n; });

		return {
			slots,
			pactMagic: pact ? {slots: pact.slots, slotLevel: pact.slotLevel} : null,
			casterLevel,
		};
	}

	async function discoverClassFiles ({includeOptional = false} = {}) {
		const names = includeOptional
			? [...PRIMARY_CLASS_FILES, ...OPTIONAL_CLASS_FILES]
			: [...PRIMARY_CLASS_FILES];
		return names;
	}

	global.CharacterBuilderLevelUp = {
		PRIMARY_CLASS_FILES,
		OPTIONAL_CLASS_FILES,
		MULTICLASS_REQUIREMENTS,
		getAbilityScore,
		getAbilitiesMap,
		checkMulticlassRequirements,
		getCasterLevelContribution,
		computeSpellSlots,
		discoverClassFiles,
		FULL_CASTER_SLOTS,
		HALF_CASTER_SLOTS,
		THIRD_CASTER_SLOTS,
		WARLOCK_PACT,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
