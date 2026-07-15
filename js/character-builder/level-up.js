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
		// Split caster classes into Warlock pact magic (always tracked separately) and the
		// "regular" Vancian casters that share the standard spell-slot tables.
		const regular = [];
		let pact = null;

		(character.class || []).forEach(cls => {
			const contrib = getCasterLevelContribution(cls);
			if (contrib.type === "none") return;
			if (contrib.type === "pact") pact = WARLOCK_PACT[Math.min(20, contrib.level) - 1];
			else regular.push(contrib);
		});

		let casterLevel = 0;
		let slotsArr = [];

		if (regular.length === 1) {
			// Single spellcasting class: use that class's OWN slot table. Half-casters
			// (Paladin/Ranger) and third-casters (Eldritch Knight/Arcane Trickster) do NOT
			// follow the full-caster table, so mapping them through it (as the multiclass
			// rule does) under-grants slots. Artificer is a half-caster that rounds UP and
			// gains slots at level 1, which matches the full table indexed by ceil(level/2).
			const c = regular[0];
			let table = FULL_CASTER_SLOTS;
			let idx = c.level;
			if (c.type === "half") { table = HALF_CASTER_SLOTS; idx = c.level; }
			else if (c.type === "third") { table = THIRD_CASTER_SLOTS; idx = c.level; }
			else if (c.type === "halfRoundUp") { table = FULL_CASTER_SLOTS; idx = Math.ceil(c.level / 2); }
			else { table = FULL_CASTER_SLOTS; idx = c.level; } // full
			casterLevel = Math.min(20, idx);
			slotsArr = casterLevel > 0 ? (table[casterLevel - 1] || []) : [];
		} else if (regular.length > 1) {
			// Multiclass spellcaster (PHB p.164): sum full levels + floor(half) + ceil(artificer)
			// + floor(third), then read the combined level off the full-caster table.
			let combined = 0;
			regular.forEach(c => {
				if (c.type === "full") combined += c.level;
				else if (c.type === "half") combined += Math.floor(c.level / 2);
				else if (c.type === "halfRoundUp") combined += Math.ceil(c.level / 2);
				else if (c.type === "third") combined += Math.floor(c.level / 3);
			});
			casterLevel = Math.min(20, combined);
			slotsArr = casterLevel > 0 ? (FULL_CASTER_SLOTS[casterLevel - 1] || []) : [];
		}

		const slots = {};
		slotsArr.forEach((n, i) => { slots[String(i + 1)] = n; });

		return {
			slots,
			pactMagic: pact ? {slots: pact.slots, slotLevel: pact.slotLevel} : null,
			casterLevel,
		};
	}

	// --------------------------------------------------------------------------------------------
	// Class-option "known" counts (invocations / metamagic / maneuvers / fighting styles).
	// Pure + data-free so both the random creator and the interactive leveler agree on how many
	// of each choosable option a character should have at their current class levels (RAW, PHB/TCE).
	// --------------------------------------------------------------------------------------------

	function _invocationsKnownWarlock (lvl) {
		if (lvl < 2) return 0;
		// PHB Warlock table: invocations known by warlock level.
		const table = {2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7, 17: 7, 18: 8, 19: 8, 20: 8};
		return table[Math.min(20, lvl)] || 0;
	}

	function _metamagicKnownSorcerer (lvl) {
		if (lvl < 3) return 0;
		if (lvl >= 17) return 4;
		if (lvl >= 10) return 3;
		return 2;
	}

	function _maneuversKnownBattleMaster (lvl) {
		if (lvl < 3) return 0;
		if (lvl >= 15) return 9;
		if (lvl >= 10) return 7;
		if (lvl >= 7) return 5;
		return 3;
	}

	function _isSubclass (cls, ...needles) {
		const sub = String(cls?.subclass?.shortName || cls?.subclass?.name || "").toLowerCase();
		return needles.some(n => sub.includes(n));
	}

	// Returns how many of each choosable class option the character should currently know, keyed by
	// option type. Multiclass-safe (sums per qualifying class).
	function getClassOptionCounts (character) {
		const out = {invocations: 0, metamagic: 0, maneuvers: 0, fightingStyles: 0};
		const classes = (character && Array.isArray(character.class)) ? character.class : [];
		for (const cls of classes) {
			const name = String(cls?.name || "").toLowerCase();
			const lvl = cls?.level || 0;
			switch (name) {
				case "warlock":
					out.invocations += _invocationsKnownWarlock(lvl);
					break;
				case "sorcerer":
					out.metamagic += _metamagicKnownSorcerer(lvl);
					break;
				case "fighter":
					if (lvl >= 1) out.fightingStyles += 1;
					// Champion gains a second fighting style at level 10 (Additional Fighting Style).
					if (lvl >= 10 && _isSubclass(cls, "champion")) out.fightingStyles += 1;
					if (_isSubclass(cls, "battle master", "battlemaster")) out.maneuvers += _maneuversKnownBattleMaster(lvl);
					break;
				case "paladin":
					if (lvl >= 2) out.fightingStyles += 1;
					break;
				case "ranger":
					if (lvl >= 2) out.fightingStyles += 1;
					break;
			}
		}
		return out;
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
		getClassOptionCounts,
		discoverClassFiles,
		FULL_CASTER_SLOTS,
		HALF_CASTER_SLOTS,
		THIRD_CASTER_SLOTS,
		WARLOCK_PACT,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
