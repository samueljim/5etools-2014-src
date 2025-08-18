"use strict";

/**
 * Character rendering utilities for 5etools player character system.
 * Renders characters using comprehensive stat blocks similar to monster stat blocks.
 * Integrates with existing 5etools rendering infrastructure for consistency.
 */

class RenderCharacters {
	static $getRenderedCharacter (character) {
		return $(RenderCharacters.getCompactRenderedString(character));
	}

	static getCompactRenderedString (character, opts = {}) {
		// Initialize character for rendering (similar to monster initialization)
		Renderer.monster.initParsed(character);
		const renderer = Renderer.get();
		
		// Convert character to monster-compatible format for rendering
		const charAsMon = RenderCharacters._convertCharacterToMonsterFormat(character);
		
		// Render using comprehensive monster-style renderer
		return RenderCharacters._getRenderedCharacter({character: charAsMon, opts, renderer});
	}

	static _convertCharacterToMonsterFormat (character) {
		const getModifier = (score) => Math.floor((score - 10) / 2);
		const profBonus = Math.ceil((character.level || 1) / 4) + 1;

		const charAsMon = {
			name: character.name,
			size: ["M"],
			type: `${character.race?.name || "humanoid"}`,
			alignment: character.alignment || ["N"],
			ac: [character.ac || 10],
			hp: character.hp || {average: (character.level || 1) * 8, formula: `${character.level || 1}d8`},
			speed: character.speed || {walk: 30},
			
			str: character.abilityScores?.str || 10,
			dex: character.abilityScores?.dex || 10,
			con: character.abilityScores?.con || 10,
			int: character.abilityScores?.int || 10,
			wis: character.abilityScores?.wis || 10,
			cha: character.abilityScores?.cha || 10,

			level: character.level || 1,
			profBonus: profBonus,
			characterClass: character.class?.name || "Adventurer",
			
			skill: RenderCharacters._getCharacterSkills(character, profBonus),
			save: RenderCharacters._getCharacterSaves(character, profBonus),
			languages: character.languages || ["Common"],
			senses: [`passive Perception ${10 + getModifier(character.abilityScores?.wis || 10) + (character.proficiencies?.skills?.includes('Perception') ? profBonus : 0)}`],
			
			trait: RenderCharacters._getCharacterTraits(character),
			action: RenderCharacters._getCharacterActions(character, profBonus),
			
			equipment: character.equipment || [],
			spells: character.spells || [],
			
			source: "HOMEBREW",
			page: 0
		};

		return charAsMon;
	}

	static _getCharacterSkills (character, profBonus) {
		if (!character.proficiencies?.skills) return null;
		
		const skillMap = {
			"Acrobatics": "dex", "Animal Handling": "wis", "Arcana": "int", "Athletics": "str",
			"Deception": "cha", "History": "int", "Insight": "wis", "Intimidation": "cha",
			"Investigation": "int", "Medicine": "wis", "Nature": "int", "Perception": "wis",
			"Performance": "cha", "Persuasion": "cha", "Religion": "int", "Sleight of Hand": "dex",
			"Stealth": "dex", "Survival": "wis"
		};

		const skills = {};
		character.proficiencies.skills.forEach(skill => {
			const ability = skillMap[skill];
			if (ability) {
				const abilityMod = Math.floor(((character.abilityScores?.[ability] || 10) - 10) / 2);
				const modifier = abilityMod + profBonus;
				skills[skill.toLowerCase().replace(/\s+/g, '')] = modifier >= 0 ? `+${modifier}` : `${modifier}`;
			}
		});

		return Object.keys(skills).length > 0 ? skills : null;
	}

	static _getCharacterSaves (character, profBonus) {
		if (!character.proficiencies?.savingThrows) return null;
		
		const saves = {};
		character.proficiencies.savingThrows.forEach(save => {
			const abilityMod = Math.floor(((character.abilityScores?.[save.toLowerCase()] || 10) - 10) / 2);
			const modifier = abilityMod + profBonus;
			saves[save.toLowerCase()] = modifier >= 0 ? `+${modifier}` : `${modifier}`;
		});

		return Object.keys(saves).length > 0 ? saves : null;
	}

	static _getCharacterTraits (character) {
		const traits = [];

		if (character.classFeatures) {
			character.classFeatures.forEach(feature => {
				traits.push({
					name: feature.name,
					entries: feature.description ? [feature.description] : [`${feature.name} class feature.`]
				});
			});
		}

		if (character.racialTraits) {
			character.racialTraits.forEach(trait => {
				traits.push({
					name: trait.name,
					entries: trait.description ? [trait.description] : [`${trait.name} racial trait.`]
				});
			});
		}

		if (character.background?.feature) {
			traits.push({
				name: character.background.feature.name,
				entries: [character.background.feature.description || `${character.background.feature.name} background feature.`]
			});
		}

		if (character.spells && character.spells.length > 0) {
			const spellcastingAbility = character.class?.spellcastingAbility || "int";
			const abilityMod = Math.floor(((character.abilityScores?.[spellcastingAbility] || 10) - 10) / 2);
			const profBonus = Math.ceil((character.level || 1) / 4) + 1;
			const spellMod = abilityMod + profBonus;
			const spellSaveDC = 8 + spellMod;

			traits.push({
				name: "Spellcasting",
				entries: [
					`${character.name} is a ${RenderCharacters._getSpellcasterLevel(character)}-level spellcaster. ${character.name}'s spellcasting ability is ${spellcastingAbility.charAt(0).toUpperCase() + spellcastingAbility.slice(1)} (spell save DC ${spellSaveDC}, ${spellMod >= 0 ? '+' : ''}${spellMod} to hit with spell attacks). ${character.name} has the following spells prepared:`,
					RenderCharacters._formatSpellList(character.spells)
				]
			});
		}

		return traits.length > 0 ? traits : null;
	}

	static _getCharacterActions (character, profBonus) {
		const actions = [];

		if (character.equipment) {
			character.equipment.forEach(item => {
				if (item.type === "weapon") {
					const isFinesse = item.properties?.includes("finesse");
					const isRanged = item.properties?.includes("ranged") || item.weaponCategory === "martial ranged";
					let abilityMod;
					
					if (isFinesse) {
						const strMod = Math.floor(((character.abilityScores?.str || 10) - 10) / 2);
						const dexMod = Math.floor(((character.abilityScores?.dex || 10) - 10) / 2);
						abilityMod = Math.max(strMod, dexMod);
					} else if (isRanged) {
						abilityMod = Math.floor(((character.abilityScores?.dex || 10) - 10) / 2);
					} else {
						abilityMod = Math.floor(((character.abilityScores?.str || 10) - 10) / 2);
					}

					const isProficient = character.proficiencies?.weapons?.includes(item.name) || 
									   character.proficiencies?.weapons?.includes(item.weaponCategory) ||
									   character.proficiencies?.weapons?.includes("simple weapons") ||
									   character.proficiencies?.weapons?.includes("martial weapons");
					const attackBonus = abilityMod + (isProficient ? profBonus : 0);
					const damageBonus = abilityMod;

					const range = item.range || (isRanged ? "range 150/600 ft." : "reach 5 ft.");
					const damage = item.damage || "1d8";
					const damageType = item.damageType || "slashing";

					actions.push({
						name: item.name,
						entries: [
							`{@atk mw,rw} ${attackBonus >= 0 ? '+' : ''}${attackBonus} to hit, ${range}, one target. {@h}${damage}${damageBonus !== 0 ? ` ${damageBonus >= 0 ? '+' : ''}${damageBonus}` : ''} ${damageType} damage.`
						]
					});
				}
			});
		}

		if (character.spells) {
			character.spells.forEach(spell => {
				if (spell.level === 0) {
					actions.push({
						name: spell.name,
						entries: [`{@spell ${spell.name}}`]
					});
				}
			});
		}

		if (character.class?.name === "Fighter" && character.level >= 2) {
			const uses = character.level < 17 ? 1 : 2;
			actions.push({
				name: `Action Surge (${uses}/Short Rest)`,
				entries: ["On your turn, you can take one additional action."]
			});
		}

		if (character.class?.name === "Fighter" && character.level >= 1) {
			actions.push({
				name: "Second Wind (1/Short Rest)",
				entries: [`You can use a bonus action to regain {@dice 1d10 + ${character.level}} hit points.`]
			});
		}

		return actions.length > 0 ? actions : null;
	}

	static _getSpellcasterLevel (character) {
		return character.level || 1;
	}

	static _formatSpellList (spells) {
		const spellsByLevel = {};
		spells.forEach(spell => {
			const level = spell.level || 0;
			if (!spellsByLevel[level]) spellsByLevel[level] = [];
			spellsByLevel[level].push(spell.name);
		});

		const lines = [];
		Object.keys(spellsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
			const levelInt = parseInt(level);
			if (levelInt === 0) {
				lines.push(`• Cantrips (at will): ${spellsByLevel[level].map(name => `{@spell ${name}}`).join(", ")}`);
			} else {
				const suffix = Parser.spLevelToFull(levelInt);
				lines.push(`• ${suffix} level: ${spellsByLevel[level].map(name => `{@spell ${name}}`).join(", ")}`);
			}
		});

		return lines.join("\\n");
	}

	static _getRenderedCharacter ({character, opts, renderer}) {
		const renderStack = [];

		// Character header with name
		renderStack.push(`<tr><td colspan="6"><h1 class="stats-name ve-flex-vh-center">
			${character.name}
			<div class="ve-flex-v-center ml-2">
				<div class="stats__hr stats__hr--name"></div>
			</div>
		</h1></td></tr>`);

		// Character type and level
		renderStack.push(`<tr><td colspan="6"><i>
			${Parser.sizeAbvToFull(character.size[0])} ${character.type} (${character.characterClass}, Level ${character.level}), ${Parser.alignmentListToFull(character.alignment)}
		</i></td></tr>`);

		renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);

		// Basic stats
		renderStack.push(`<tr>
			<td colspan="2"><b>Armor Class</b> ${character.ac[0]}</td>
			<td colspan="2"><b>Hit Points</b> ${Renderer.monster.getRenderedHp(character.hp)}</td>
			<td colspan="2"><b>Speed</b> ${Parser.getSpeedString(character)}</td>
		</tr>`);

		renderStack.push(`<tr>
			<td colspan="2"><b>Level</b> ${character.level}</td>
			<td colspan="2"><b>Proficiency Bonus</b> +${character.profBonus}</td>
			<td colspan="2"></td>
		</tr>`);

		renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);

		// Ability scores using monster renderer
		renderStack.push(Renderer.monster.getRenderedAbilityScores(character, "classic"));

		renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);

		// Saves, skills, senses, languages
		if (character.save) {
			renderStack.push(`<tr><td colspan="6"><p><b>Saving Throws</b> ${Renderer.monster.getSavesPart(character)}</p></td></tr>`);
		}
		if (character.skill) {
			renderStack.push(`<tr><td colspan="6"><p><b>Skills</b> ${Renderer.monster.getSkillsString(renderer, character)}</p></td></tr>`);
		}
		if (character.senses) {
			renderStack.push(`<tr><td colspan="6"><p><b>Senses</b> ${character.senses.join(", ")}</p></td></tr>`);
		}
		if (character.languages) {
			renderStack.push(`<tr><td colspan="6"><p><b>Languages</b> ${Renderer.monster.getRenderedLanguages(character.languages)}</p></td></tr>`);
		}

		// Equipment section
		if (character.equipment && character.equipment.length > 0) {
			renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);
			renderStack.push(`<tr><td colspan="6"><h3 class="stats__sect-header-inner">Equipment</h3></td></tr>`);
			
			const weaponItems = character.equipment.filter(item => item.type === "weapon");
			const armorItems = character.equipment.filter(item => item.type === "armor");
			const otherItems = character.equipment.filter(item => !["weapon", "armor"].includes(item.type));
			
			if (weaponItems.length > 0) {
				const weapons = weaponItems.map(item => {
					let desc = item.name;
					if (item.damage) desc += ` (${item.damage} ${item.damageType})`;
					if (item.properties) desc += ` (${item.properties.join(", ")})`;
					return desc;
				});
				renderStack.push(`<tr><td colspan="6"><p><b>Weapons:</b> ${weapons.join(", ")}</p></td></tr>`);
			}
			
			if (armorItems.length > 0) {
				const armor = armorItems.map(item => {
					let desc = item.name;
					if (item.ac) desc += ` (AC ${item.ac})`;
					return desc;
				});
				renderStack.push(`<tr><td colspan="6"><p><b>Armor:</b> ${armor.join(", ")}</p></td></tr>`);
			}
			
			if (otherItems.length > 0) {
				const other = otherItems.map(item => {
					let desc = item.name;
					if (item.quantity && item.quantity > 1) desc += ` (×${item.quantity})`;
					return desc;
				});
				renderStack.push(`<tr><td colspan="6"><p><b>Other Equipment:</b> ${other.join(", ")}</p></td></tr>`);
			}
		}

		// Traits (features, racial traits, etc.)
		if (character.trait) {
			renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);
			character.trait.forEach(trait => {
				renderStack.push(`<tr><td colspan="6"><p><b><i>${trait.name}.</i></b> ${renderer.render({entries: trait.entries})}</p></td></tr>`);
			});
		}

		// Actions
		if (character.action) {
			renderStack.push(`<tr><td colspan="6"><div class="ve-tbl-divider mb-0"></div></td></tr>`);
			renderStack.push(`<tr><td colspan="6"><h3 class="stats__sect-header-inner">Actions</h3></td></tr>`);
			character.action.forEach(action => {
				renderStack.push(`<tr><td colspan="6"><p><b><i>${action.name}.</i></b> ${renderer.render({entries: action.entries})}</p></td></tr>`);
			});
		}

		return `<table class="w-100 stats stats--book"><tbody>${renderStack.join("")}</tbody></table>`;
	}
}
