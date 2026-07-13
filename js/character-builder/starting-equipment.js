"use strict";

/**
 * Data-driven starting equipment resolver for class + background JSON.
 */
(function (global) {
	const CHOICE_KEYS = ["a", "b", "c", "d", "e", "f"];

	const EQUIPMENT_TYPE_FILTERS = {
		weaponSimple: (it) => it.weaponCategory === "simple" && !it.staff && it.type !== "$",
		weaponMartial: (it) => it.weaponCategory === "martial",
		weaponSimpleMelee: (it) => it.weaponCategory === "simple" && (it.property || []).includes("M") === false && !(it.property || []).includes("R") && !/ranged/i.test(it.weaponCategory || ""),
		weaponMartialMelee: (it) => it.weaponCategory === "martial" && !(it.property || []).includes("A") && !(it.property || []).includes("R"),
		focusSpellcastingArcane: (it) => /arcane focus/i.test(it.type) || /crystal|orb|rod|staff|wand/i.test(it.name || ""),
		focusSpellcastingHoly: (it) => /holy symbol/i.test(it.name || "") || /holy symbol/i.test(it.type || ""),
		focusSpellcastingDruidic: (it) => /druidic focus|sprig of mistletoe|totem|wooden staff|yew wand/i.test(it.name || ""),
		toolArtisan: (it) => /artisan'?s tools/i.test(it.type) || /tools$/i.test(it.name || ""),
		instrumentMusical: (it) => /musical instrument|instrument/i.test(it.type) || /lute|flute|drum|viol|horn|bagpipes|lyre|pan flute|shawm|dulcimer/i.test(it.name || ""),
		setGaming: (it) => /gaming set/i.test(it.type) || /dice set|dragonchess|playing card|three-dragon ante/i.test(it.name || ""),
	};

	function parseItemUid (uid) {
		if (!uid || typeof uid !== "string") return null;
		const [name, source] = uid.split("|");
		if (!name) return null;
		return {name: name.trim(), source: (source || "PHB").trim()};
	}

	function toEquipmentRow (item, quantity = 1, extra = {}) {
		const uid = typeof item === "string" ? parseItemUid(item) : item;
		if (!uid?.name) return null;
		const tag = `{@item ${uid.name}|${uid.source || "PHB"}}`;
		return {
			name: tag,
			quantity: quantity || 1,
			...extra,
		};
	}

	function pickRandom (arr) {
		if (!arr?.length) return null;
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function resolveEquipmentType (equipmentType, itemsDb, rngPick) {
		const filterFn = EQUIPMENT_TYPE_FILTERS[equipmentType];
		if (!filterFn || !itemsDb?.length) {
			// Fallback readable placeholders
			const fallbacks = {
				weaponSimple: "dagger|phb",
				weaponMartial: "longsword|phb",
				weaponSimpleMelee: "mace|phb",
				weaponMartialMelee: "longsword|phb",
				focusSpellcastingArcane: "arcane focus|phb",
				focusSpellcastingHoly: "holy symbol|phb",
				focusSpellcastingDruidic: "druidic focus|phb",
				toolArtisan: "smith's tools|phb",
				instrumentMusical: "lute|phb",
				setGaming: "dice set|phb",
			};
			return parseItemUid(fallbacks[equipmentType] || "dagger|phb");
		}

		const candidates = itemsDb.filter(it => {
			try { return filterFn(it); } catch (e) { return false; }
		});
		const picked = rngPick ? rngPick(candidates) : pickRandom(candidates);
		if (!picked) return parseItemUid("dagger|phb");
		return {name: picked.name, source: picked.source || "PHB"};
	}

	function expandEntry (entry, {itemsDb, typePicks, path, random}) {
		const out = [];
		if (entry == null) return out;

		if (typeof entry === "string") {
			const row = toEquipmentRow(entry);
			if (row) out.push(row);
			return out;
		}

		if (typeof entry !== "object") return out;

		if (entry.special) {
			out.push({
				name: entry.displayName || entry.special,
				quantity: entry.quantity || 1,
				description: entry.special,
				isSpecial: true,
			});
			return out;
		}

		if (entry.equipmentType) {
			const forced = typePicks?.[path];
			const uid = forced
				? (typeof forced === "string" ? parseItemUid(forced) : forced)
				: resolveEquipmentType(entry.equipmentType, itemsDb, random ? pickRandom : (arr) => arr[0]);
			const qty = entry.quantity || 1;
			const row = toEquipmentRow(uid, qty);
			if (row) out.push(row);
			return out;
		}

		if (entry.item) {
			const row = toEquipmentRow(`${entry.item}${entry.item.includes("|") ? "" : "|phb"}`, entry.quantity || 1, {
				description: entry.displayName,
			});
			if (row) {
				if (entry.containsValue != null) row.containsValue = entry.containsValue;
				out.push(row);
			}
			return out;
		}

		return out;
	}

	function resolveChoiceGroup (group, {choice, random, abilityScores, itemsDb, typePicks, groupIndex, source}) {
		const out = [];
		const currencyGain = {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0};

		if (!group || typeof group !== "object") return {items: out, currencyGain};

		// Mandatory
		if (Array.isArray(group._)) {
			group._.forEach((entry, i) => {
				const rows = expandEntry(entry, {
					itemsDb,
					typePicks,
					path: `${source}:${groupIndex}:_:${i}`,
					random,
				});
				rows.forEach(r => {
					if (r.containsValue != null) {
						currencyGain.gp += Math.floor(Number(r.containsValue) / 100) || 0;
						delete r.containsValue;
					}
					out.push(r);
				});
			});
		}

		const availableKeys = CHOICE_KEYS.filter(k => group[k]);
		let selectedKey = null;
		if (availableKeys.length) {
			selectedKey = choice;
			if (!selectedKey || !group[selectedKey]) {
				if (random) {
					selectedKey = heuristicPick(availableKeys, group, abilityScores) || pickRandom(availableKeys);
				} else {
					selectedKey = availableKeys[0];
				}
			}
			const selected = group[selectedKey];
			if (Array.isArray(selected)) {
				selected.forEach((entry, i) => {
					const rows = expandEntry(entry, {
						itemsDb,
						typePicks,
						path: `${source}:${groupIndex}:${selectedKey}:${i}`,
						random,
					});
					rows.forEach(r => {
						if (r.containsValue != null) {
							currencyGain.gp += Math.floor(Number(r.containsValue) / 100) || 0;
							delete r.containsValue;
						}
						out.push(r);
					});
				});
			}
		}

		return {items: out, currencyGain, selectedKey};
	}

	function heuristicPick (keys, group, abilityScores) {
		if (!abilityScores) return null;
		const str = abilityScores.str || 10;
		const dex = abilityScores.dex || 10;
		// Prefer armor/weapon options that match STR vs DEX for first group containing chain/leather
		const blob = JSON.stringify(group).toLowerCase();
		if (blob.includes("chain mail") && blob.includes("leather")) {
			return str >= dex ? (keys.includes("a") ? "a" : keys[0]) : (keys.includes("b") ? "b" : keys[0]);
		}
		return null;
	}

	/**
	 * @param {object} opts
	 * @param {object} [opts.classStartingEquipment] class.startingEquipment from class JSON
	 * @param {array} [opts.backgroundStartingEquipment] background.startingEquipment
	 * @param {boolean} [opts.random]
	 * @param {object} [opts.choices] { class: ["a","b",...], background: ["a",...] }
	 * @param {object} [opts.typePicks] map of path → item uid
	 * @param {array} [opts.itemsDb] items array
	 * @param {object} [opts.abilityScores]
	 */
	function resolveStartingEquipment (opts = {}) {
		const {
			classStartingEquipment = null,
			backgroundStartingEquipment = null,
			random = false,
			choices = {},
			typePicks = {},
			itemsDb = [],
			abilityScores = null,
		} = opts;

		const equipment = [];
		const currency = {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0};
		const meta = {classSelections: [], backgroundSelections: []};

		const classGroups = classStartingEquipment?.defaultData || [];
		classGroups.forEach((group, idx) => {
			const choice = choices.class?.[idx];
			const resolved = resolveChoiceGroup(group, {
				choice,
				random,
				abilityScores,
				itemsDb,
				typePicks,
				groupIndex: idx,
				source: "class",
			});
			equipment.push(...resolved.items);
			Object.keys(currency).forEach(k => { currency[k] += resolved.currencyGain[k] || 0; });
			if (resolved.selectedKey) meta.classSelections[idx] = resolved.selectedKey;
		});

		const bgGroups = Array.isArray(backgroundStartingEquipment) ? backgroundStartingEquipment : [];
		bgGroups.forEach((group, idx) => {
			const choice = choices.background?.[idx];
			const resolved = resolveChoiceGroup(group, {
				choice,
				random,
				abilityScores,
				itemsDb,
				typePicks,
				groupIndex: idx,
				source: "background",
			});
			equipment.push(...resolved.items);
			Object.keys(currency).forEach(k => { currency[k] += resolved.currencyGain[k] || 0; });
			if (resolved.selectedKey) meta.backgroundSelections[idx] = resolved.selectedKey;
		});

		return {equipment, currency, meta};
	}

	function applyEquipmentToCharacter (character, resolved) {
		if (!character || !resolved) return character;
		character.equipment = (character.equipment || []).concat(resolved.equipment || []);

		// Mirror into entries Items section for compatibility
		if (!character.entries) character.entries = [];
		let itemsSection = character.entries.find(e => e.type === "section" && e.name === "Items");
		if (!itemsSection) {
			itemsSection = {type: "section", name: "Items", entries: []};
			character.entries.push(itemsSection);
		}
		(resolved.equipment || []).forEach(row => {
			const label = row.quantity > 1 ? `${row.name} ×${row.quantity}` : row.name;
			if (!itemsSection.entries.includes(label) && !itemsSection.entries.includes(row.name)) {
				itemsSection.entries.push(label);
			}
		});

		if (resolved.currency) {
			character.currency = character.currency || {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0};
			Object.keys(resolved.currency).forEach(k => {
				character.currency[k] = (character.currency[k] || 0) + (resolved.currency[k] || 0);
			});
		}
		return character;
	}

	function describeChoiceGroups (classStartingEquipment, backgroundStartingEquipment) {
		const describe = (groups, source) => (groups || []).map((group, index) => {
			const keys = CHOICE_KEYS.filter(k => group[k]);
			return {
				source,
				index,
				mandatory: group._ || null,
				options: keys.map(k => ({key: k, items: group[k]})),
			};
		});
		return {
			class: describe(classStartingEquipment?.defaultData, "class"),
			background: describe(backgroundStartingEquipment, "background"),
		};
	}

	global.CharacterBuilderStartingEquipment = {
		resolveStartingEquipment,
		applyEquipmentToCharacter,
		describeChoiceGroups,
		CHOICE_KEYS,
		parseItemUid,
		toEquipmentRow,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
