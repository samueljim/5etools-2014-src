"use strict";

/**
 * Lightweight smoke tests for character-builder modules (Node, no DOM).
 * Run: node test/test-character-builder-modules.js
 */

const path = require("path");
const fs = require("fs");
const vm = require("vm");

function loadScript (rel) {
	const code = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
	const sandbox = {globalThis: {}, window: {}, console, Parser: {SRC_PHB: "PHB"}};
	sandbox.globalThis = sandbox;
	sandbox.window = sandbox;
	vm.createContext(sandbox);
	vm.runInContext(code, sandbox);
	return sandbox;
}

function assert (cond, msg) {
	if (!cond) throw new Error(msg);
}

// --- spell-filter-context ---
{
	const sandbox = loadScript("js/character-builder/spell-filter-context.js");
	const ctx = sandbox.CharacterBuilderSpellFilterContext;
	assert(ctx, "spell filter context loaded");
	assert(!ctx.FULL_CASTERS.has("Artificer"), "Artificer not in full casters set");
	assert(ctx.getMaxSpellLevelForClass({name: "Wizard", level: 5}) === 5, "wizard L5 max spell level");
	assert(ctx.getMaxSpellLevelForClass({name: "Paladin", level: 5}) === 2, "paladin half caster");
	assert(ctx.getMaxSpellLevelForClass({name: "Artificer", level: 5}) === 2, "artificer L5 max spell level 2");
	console.log("ok spell-filter-context");
}

// --- subclass-options ---
{
	const sandbox = loadScript("js/character-builder/subclass-options.js");
	const Sub = sandbox.CharacterBuilderSubclassOptions;
	assert(Sub.getSubclassLevel("Fighter") === 3, "fighter subclass at 3");
	assert(Sub.getSubclassLevel("Warlock") === 1, "warlock subclass at 1");
	assert(Sub.getSubclassLevel("Artificer") === 3, "artificer subclass at 3");
	const def = Sub.findSubclassOptionDef({featureName: "The Genie", subclass: {shortName: "Genie"}});
	assert(def && def.options.some(o => o.value === "Marid"), "genie kind options");
	const character = {class: [{name: "Warlock", subclass: {name: "The Genie", shortName: "Genie"}}]};
	Sub.applySubSubclass(character, {className: "Warlock", subSubclass: "Marid"});
	assert(character.class[0].subclass.subSubclass === "Marid", "subSubclass persisted");
	assert(Sub.needsSubclassSelection({name: "Fighter", level: 3}, null) === true, "fighter 3 needs subclass");
	assert(Sub.needsSubclassSelection({name: "Fighter", level: 3, subclass: {name: "Champion"}}, null) === false, "fighter with subclass ok");
	console.log("ok subclass-options");
}

// --- starting-equipment ---
{
	const sandbox = loadScript("js/character-builder/starting-equipment.js");
	const Eq = sandbox.CharacterBuilderStartingEquipment;
	const warlockDefaultData = [
		{a: ["light crossbow|phb", "crossbow bolts (20)|phb"], b: [{equipmentType: "weaponSimple"}]},
		{a: ["component pouch|phb"], b: [{equipmentType: "focusSpellcastingArcane"}]},
		{a: ["scholar's pack|phb"], b: ["dungeoneer's pack|phb"]},
		{_: ["leather armor|phb", {equipmentType: "weaponSimple"}, {item: "dagger|phb", quantity: 2}]},
	];
	const bg = [
		{_: [{item: "holy symbol|phb"}, "common clothes|phb", {item: "pouch|phb", containsValue: 1500}]},
		{a: [{item: "book|phb", displayName: "prayer book"}], b: [{special: "prayer wheel"}]},
	];
	const resolved = Eq.resolveStartingEquipment({
		classStartingEquipment: {defaultData: warlockDefaultData},
		backgroundStartingEquipment: bg,
		random: true,
		abilityScores: {str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16},
	});
	assert(resolved.equipment.length >= 5, `expected several items, got ${resolved.equipment.length}`);
	assert(resolved.currency.gp >= 15, "pouch containsValue → gp");
	const character = {entries: []};
	Eq.applyEquipmentToCharacter(character, resolved);
	assert(character.equipment.length === resolved.equipment.length, "equipment field written");
	assert(character.entries.some(e => e.name === "Items"), "Items section mirrored");
	console.log("ok starting-equipment");
}

// --- level-up helpers ---
{
	const sandbox = loadScript("js/character-builder/level-up.js");
	const L = sandbox.CharacterBuilderLevelUp;
	assert(L.PRIMARY_CLASS_FILES.includes("artificer"), "artificer in primary list");
	assert(!L.PRIMARY_CLASS_FILES.includes("mystic"), "mystic excluded by default");
	const check = L.checkMulticlassRequirements({str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16}, "Warlock");
	assert(check.eligible, "warlock cha 16 eligible");
	const checkBad = L.checkMulticlassRequirements({str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10}, "Warlock");
	assert(!checkBad.eligible, "warlock cha 10 ineligible");
	const fighterOr = L.checkMulticlassRequirements({str: 8, dex: 14, con: 10, int: 10, wis: 10, cha: 10}, "Fighter");
	assert(fighterOr.eligible, "fighter dex 14 eligible");
	const slots = L.computeSpellSlots({
		class: [
			{name: "Wizard", level: 3},
			{name: "Warlock", level: 2},
		],
	});
	assert(slots.casterLevel === 3, "wizard levels only for combined slots");
	assert(slots.pactMagic && slots.pactMagic.slots === 2, "warlock pact separate");
	assert(slots.slots["1"] === 4 && slots.slots["2"] === 2, "wizard L3 slots");
	const art = L.computeSpellSlots({class: [{name: "Artificer", level: 5}]});
	assert(art.casterLevel === 3, "artificer half round up");
	console.log("ok level-up helpers");
}

console.log("\nAll character-builder module smoke tests passed.");
