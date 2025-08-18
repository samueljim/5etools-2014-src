"use strict";

/**
 * Character rendering utilities for 5etools player character system.
 * Handles the display and formatting of character data in interactive stat blocks.
 * Based on the Renderer.monster patterns for consistency with the existing application.
 */

class RenderCharacters {
	/**
	 * Renders a complete character stat block with interactive elements
	 * @param {Object} character - Character data to render
	 * @returns {jQuery} Rendered character stat block
	 */
	static $getRenderedCharacter (character) {
		const $content = $(`<table class="w-100 stats stats--book stats--character"><tbody></tbody></table>`);
		const $tbody = $content.find(`tbody`);

		$tbody.append(`<tr><th class="ve-tbl-border" colspan="6"></th></tr>`);

		// Character header
		$tbody.append(this._getCharacterHeader(character));

		// Basic character info
		$tbody.append(this._getCharacterBasicInfo(character));

		// Ability scores (interactive like monster stat blocks)
		if (character.abilityScores) {
			$tbody.append(this._getAbilityScores(character));
		}

		// Hit points (interactive)
		if (character.hitPoints) {
			$tbody.append(this._getHitPoints(character));
		}

		// Proficiencies and skills
		if (this._hasProficiencies(character)) {
			$tbody.append(this._getProficiencies(character));
		}

		// Equipment (clickable for details)
		if (character.equipment && character.equipment.length) {
			$tbody.append(this._getEquipment(character));
		}

		// Spellcasting (interactive like monster spellcasting)
		if (character.spellcasting && this._hasSpellcasting(character)) {
			$tbody.append(this._getSpellcasting(character));
		}

		// Features and traits
		if (character.features && character.features.length) {
			$tbody.append(this._getFeatures(character));
		}

		$tbody.append(`<tr><th class="ve-tbl-border" colspan="6"></th></tr>`);

		return $content;
	}

	/**
	 * Renders character header with name and basic info
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for character header
	 */
	static _getCharacterHeader (character) {
		const level = character.level || 1;
		const raceName = character.race ? character.race.name : "Unknown";
		const subraceName = character.race?.subrace ? ` (${character.race.subrace})` : "";
		const className = character.class ? character.class.name : "Unknown";
		const subclassName = character.class?.subclass?.name ? ` (${character.class.subclass.name})` : "";

		return `<tr><td colspan="6">
			<h1 class="stats-name">${character.name}</h1>
			<p class="stats-size-type-alignment">
				<i>Level ${level} ${raceName}${subraceName} ${className}${subclassName}</i>
			</p>
		</td></tr>`;
	}

	/**
	 * Renders basic character information
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for basic character info
	 */
	static _getCharacterBasicInfo (character) {
		const proficiencyBonus = CharacterUtil.getProficiencyBonus(character.level || 1);
		const backgroundName = character.background ? character.background.name : "Unknown";

		return `<tr><td colspan="6">
			<table class="w-100 summary-noback relative table-layout-fixed my-1">
				<tr>
					<td class="ve-col-4"><strong>Background</strong></td>
					<td class="ve-col-4"><strong>Proficiency Bonus</strong></td>
					<td class="ve-col-4"><strong>Speed</strong></td>
				</tr>
				<tr>
					<td class="ve-col-4">${backgroundName}</td>
					<td class="ve-col-4">+${proficiencyBonus}</td>
					<td class="ve-col-4">${character.speed || "30 ft."}</td>
				</tr>
			</table>
		</td></tr>`;
	}

	/**
	 * Renders ability scores with modifiers (interactive, like monster stat blocks)
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for ability scores
	 */
	static _getAbilityScores (character) {
		const abilities = ["str", "dex", "con", "int", "wis", "cha"];
		const abilityNames = {
			str: "STR", dex: "DEX", con: "CON", 
			int: "INT", wis: "WIS", cha: "CHA"
		};

		const abilityCells = abilities.map(ab => {
			const score = character.abilityScores[ab] || 10;
			const modifier = CharacterUtil.getAbilityModifier(score);
			const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
			
			// Make ability scores clickable for dice rolling (like monster stats)
			return `<td class="ve-col-2 ability-score-cell">
				<strong>${abilityNames[ab]}</strong><br>
				<span class="ability-score" data-ability="${ab}" data-score="${score}" 
					  title="Click to roll d20${modStr}"
					  style="cursor: pointer;">
					${score} (${modStr})
				</span>
			</td>`;
		}).join("");

		return `<tr><td colspan="6">
			<table class="w-100 mt-1 ability-scores">
				<tr>
					${abilityCells}
				</tr>
			</table>
		</td></tr>`;
	}

	/**
	 * Renders hit points (interactive)
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for hit points
	 */
	static _getHitPoints (character) {
		const hp = character.hitPoints;
		const current = hp.current || 0;
		const max = hp.max || 0;
		const temp = hp.temp || 0;

		const hpDisplay = temp > 0 ? `${current + temp} (${current}+${temp})/${max}` : `${current}/${max}`;

		return `<tr><td colspan="6">
			<div class="my-1">
				<strong>Hit Points:</strong> 
				<span class="hit-points" data-current="${current}" data-max="${max}" data-temp="${temp}"
					  title="Click to manage hit points" style="cursor: pointer;">
					${hpDisplay}
				</span>
			</div>
		</td></tr>`;
	}

	/**
	 * Renders proficiencies and skills
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for proficiencies
	 */
	static _getProficiencies (character) {
		let content = "";

		// Saving throws
		if (character.savingThrows) {
			const saves = Object.entries(character.savingThrows)
				.filter(([_, prof]) => prof)
				.map(([ability, _]) => {
					const mod = CharacterUtil.getAbilityModifier(character.abilityScores[ability] || 10);
					const profBonus = CharacterUtil.getProficiencyBonus(character.level || 1);
					const total = mod + profBonus;
					const totalStr = total >= 0 ? `+${total}` : `${total}`;
					return `${ability.toUpperCase()} ${totalStr}`;
				});
			
			if (saves.length) {
				content += `<div class="my-1"><strong>Saving Throws:</strong> ${saves.join(", ")}</div>`;
			}
		}

		// Skills
		if (character.skills) {
			const skills = Object.entries(character.skills)
				.filter(([_, prof]) => prof)
				.map(([skill, profLevel]) => {
					// TODO: Calculate skill modifiers based on proficiency level
					return skill.replace(/([A-Z])/g, ' $1').trim();
				});
			
			if (skills.length) {
				content += `<div class="my-1"><strong>Skills:</strong> ${skills.join(", ")}</div>`;
			}
		}

		return content ? `<tr><td colspan="6">${content}</td></tr>` : "";
	}

	/**
	 * Renders equipment with clickable items
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for equipment
	 */
	static _getEquipment (character) {
		if (!character.equipment || !character.equipment.length) return "";

		const weapons = character.equipment.filter(item => item.type === "weapon");
		const armor = character.equipment.filter(item => item.type === "armor");
		const other = character.equipment.filter(item => !["weapon", "armor"].includes(item.type));

		let content = "";

		if (weapons.length) {
			const weaponList = weapons.map(weapon => {
				const attackBonus = this._calculateAttackBonus(character, weapon);
				const damage = this._calculateDamage(character, weapon);
				return `<span class="weapon-item" data-weapon='${JSON.stringify(weapon)}' 
						  title="Click to roll attack" style="cursor: pointer;">
					${weapon.name} ${attackBonus} (${damage})
				</span>`;
			}).join(", ");
			content += `<div class="my-1"><strong>Attacks:</strong> ${weaponList}</div>`;
		}

		if (armor.length) {
			const armorList = armor.map(item => item.name).join(", ");
			content += `<div class="my-1"><strong>Armor:</strong> ${armorList}</div>`;
		}

		return content ? `<tr><td colspan="6">${content}</td></tr>` : "";
	}

	/**
	 * Renders spellcasting (interactive like monster spellcasting)
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for spellcasting
	 */
	static _getSpellcasting (character) {
		const spellcasting = character.spellcasting;
		let content = "";

		// Spell slots
		if (spellcasting.slots) {
			const slotsList = [];
			for (let level = 1; level <= 9; level++) {
				const slot = spellcasting.slots[level.toString()];
				if (slot && slot.max > 0) {
					const used = slot.used || 0;
					const remaining = slot.max - used;
					slotsList.push(`${level}${this._getOrdinalSuffix(level)} (${remaining}/${slot.max})`);
				}
			}
			if (slotsList.length) {
				content += `<div class="my-1"><strong>Spell Slots:</strong> ${slotsList.join(", ")}</div>`;
			}
		}

		// Known/Prepared spells
		if (spellcasting.known && spellcasting.known.length) {
			const spellList = spellcasting.known.map(spell => 
				`<span class="spell-item" data-spell='${JSON.stringify(spell)}' 
				   title="Click for spell details" style="cursor: pointer;">
					${spell.name}
				</span>`
			).join(", ");
			content += `<div class="my-1"><strong>Spells Known:</strong> ${spellList}</div>`;
		}

		return content ? `<tr><td colspan="6">${content}</td></tr>` : "";
	}

	/**
	 * Renders character features and traits
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for features
	 */
	static _getFeatures (character) {
		if (!character.features || !character.features.length) return "";

		const featureList = character.features.map(feature => 
			`<div class="feature-item my-2">
				<strong>${feature.name}.</strong> ${feature.description || "No description available."}
			</div>`
		).join("");

		return `<tr><td colspan="6">
			<div class="my-1">
				<strong>Features & Traits</strong>
				${featureList}
			</div>
		</td></tr>`;
	}

	// Helper methods
	static _hasProficiencies (character) {
		return (character.savingThrows && Object.values(character.savingThrows).some(Boolean)) ||
			   (character.skills && Object.values(character.skills).some(Boolean));
	}

	static _hasSpellcasting (character) {
		const sc = character.spellcasting;
		return sc && (
			(sc.slots && Object.values(sc.slots).some(slot => slot.max > 0)) ||
			(sc.known && sc.known.length > 0) ||
			(sc.prepared && sc.prepared.length > 0)
		);
	}

	static _calculateAttackBonus (character, weapon) {
		// Simple attack bonus calculation - can be enhanced
		const abilityMod = weapon.ability ? 
			CharacterUtil.getAbilityModifier(character.abilityScores[weapon.ability] || 10) : 0;
		const profBonus = weapon.proficient ? CharacterUtil.getProficiencyBonus(character.level || 1) : 0;
		const total = abilityMod + profBonus + (weapon.enchantment || 0);
		return total >= 0 ? `+${total}` : `${total}`;
	}

	static _calculateDamage (character, weapon) {
		// Simple damage calculation - can be enhanced
		const abilityMod = weapon.ability ? 
			CharacterUtil.getAbilityModifier(character.abilityScores[weapon.ability] || 10) : 0;
		const bonus = abilityMod + (weapon.enchantment || 0);
		const bonusStr = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : "";
		return `${weapon.damage || "1d4"}${bonusStr} ${weapon.damageType || ""}`.trim();
	}

	static _getOrdinalSuffix (num) {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) return "st";
		if (j === 2 && k !== 12) return "nd";
		if (j === 3 && k !== 13) return "rd";
		return "th";
	}
}

// Initialize interactive elements when character is rendered
$(document).ready(() => {
	// Ability score clicking for dice rolls
	$(document).on('click', '.ability-score', function() {
		const ability = $(this).data('ability');
		const score = $(this).data('score');
		const modifier = CharacterUtil.getAbilityModifier(score);
		const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
		
		// Use 5etools dice roller
		const roll = `1d20${modStr}`;
		Renderer.dice.pRollerClick(null, roll, `${ability.toUpperCase()} Check`);
	});

	// Weapon attack clicking
	$(document).on('click', '.weapon-item', function() {
		const weapon = JSON.parse($(this).data('weapon'));
		const attackRoll = `1d20${weapon.attackBonus || '+0'}`;
		const damageRoll = weapon.damage || '1d4';
		
		Renderer.dice.pRollerClick(null, attackRoll, `${weapon.name} Attack`);
		setTimeout(() => {
			Renderer.dice.pRollerClick(null, damageRoll, `${weapon.name} Damage`);
		}, 100);
	});

	// Hit point management
	$(document).on('click', '.hit-points', function() {
		const current = $(this).data('current');
		const max = $(this).data('max');
		const temp = $(this).data('temp');
		
		// Simple hit point modification dialog
		const newCurrent = prompt(`Current HP: ${current}/${max} (Temp: ${temp})\nEnter new current HP:`, current);
		if (newCurrent !== null && !isNaN(newCurrent)) {
			$(this).data('current', Math.max(0, Math.min(max, parseInt(newCurrent))));
			// TODO: Update character data and save
		}
	});
});

		// Spellcasting
		if (character.spellcasting && this._hasSpellcasting(character)) {
			$tbody.append(this._getSpellcasting(character));
		}

		// Custom features
		if (character.customFeatures && character.customFeatures.length) {
			$tbody.append(this._getCustomFeatures(character));
		}

		// Custom notes
		if (character.customNotes && character.customNotes.trim()) {
			$tbody.append(this._getCustomNotes(character));
		}

		$tbody.append(`<tr><th class="ve-tbl-border" colspan="6"></th></tr>`);

		return $content;
	}

	/**
	 * Renders character header with name and basic info
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for character header
	 */
	static _getCharacterHeader (character) {
		const level = character.level || 1;
		const raceName = character.race ? character.race.name : "Unknown";
		const subraceName = character.race?.subrace ? ` (${character.race.subrace})` : "";
		const className = character.class ? character.class.name : "Unknown";
		const subclassName = character.class?.subclass?.name ? ` (${character.class.subclass.name})` : "";

		return `<tr><td colspan="6">
			<h1 class="stats-name">${character.name}</h1>
			<p class="stats-size-type-alignment">
				<i>Level ${level} ${raceName}${subraceName} ${className}${subclassName}</i>
			</p>
		</td></tr>`;
	}

	/**
	 * Renders basic character information
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for basic character info
	 */
	static _getCharacterBasicInfo (character) {
		const proficiencyBonus = CharacterUtil.getProficiencyBonus(character.level || 1);
		const backgroundName = character.background ? character.background.name : "Unknown";

		return `<tr><td colspan="6">
			<table class="w-100 summary-noback relative table-layout-fixed my-1">
				<tr>
					<td class="ve-col-4"><strong>Background</strong></td>
					<td class="ve-col-4"><strong>Proficiency Bonus</strong></td>
					<td class="ve-col-4"></td>
				</tr>
				<tr>
					<td class="ve-col-4">${backgroundName}</td>
					<td class="ve-col-4">+${proficiencyBonus}</td>
					<td class="ve-col-4"></td>
				</tr>
			</table>
		</td></tr>`;
	}

	/**
	 * Renders ability scores with modifiers
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for ability scores
	 */
	static _getAbilityScores (character) {
		const abilities = ["str", "dex", "con", "int", "wis", "cha"];
		const renderer = Renderer.get();

		// Create ability score table in bestiary style
		const abilityHeaders = abilities.map(ab => `<th class="ve-col-2 ve-text-center bold">${ab.toUpperCase()}</th>`).join("");
		const abilityValues = abilities.map(ab => {
			const score = character.abilityScores[ab] || 10;
			const abilityRoller = renderer.render(`{@ability ${ab} ${score}}`);
			return `<td class="ve-text-center">${abilityRoller}</td>`;
		}).join("");

		return `<tr><td colspan="6">
			<table class="w-100 summary-noback relative table-layout-fixed my-1">
				<tr>${abilityHeaders}</tr>
				<tr>${abilityValues}</tr>
			</table>
		</td></tr>`;
	}

	/**
	 * Renders hit points information
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for hit points
	 */
	static _getHitPoints (character) {
		const hp = character.hitPoints;
		const maxHp = hp.max || 0;
		const currentHp = hp.current || 0;
		const tempHp = hp.temp || 0;

		return `<tr><td colspan="6">
			<div class="character-hit-points">
				<h3>Hit Points</h3>
				<div class="hit-points-display">
					<div><strong>Maximum:</strong> ${maxHp}</div>
					<div><strong>Current:</strong> ${currentHp}</div>
					${tempHp > 0 ? `<div><strong>Temporary:</strong> ${tempHp}</div>` : ""}
				</div>
			</div>
		</td></tr>`;
	}

	/**
	 * Renders racial features
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for racial features
	 */
	static _getRacialFeatures (character) {
		const featuresHtml = character._racialFeatures.map(feature => {
			return `<div class="racial-feature">
				<h4>${feature.name}</h4>
				<p>${feature.description || ""}</p>
			</div>`;
		}).join("");

		return `<tr><td colspan="6">
			<div class="character-racial-features">
				<h3>Racial Features</h3>
				${featuresHtml}
			</div>
		</td></tr>`;
	}

	/**
	 * Renders class features
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for class features
	 */
	static _getClassFeatures (character) {
		const featuresHtml = character._classFeatures.map(feature => {
			return `<div class="class-feature">
				<h4>${feature.name}</h4>
				<p>${feature.description || ""}</p>
			</div>`;
		}).join("");

		return `<tr><td colspan="6">
			<div class="character-class-features">
				<h3>Class Features</h3>
				${featuresHtml}
			</div>
		</td></tr>`;
	}

	/**
	 * Renders proficiencies
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for proficiencies
	 */
	static _getProficiencies (character) {
		let proficienciesHtml = "";

		// Languages
		if (character._languageProficiencies && character._languageProficiencies.length > 0) {
			const languages = character._languageProficiencies
				.filter(lang => lang.language !== "choice")
				.map(lang => lang.language.charAt(0).toUpperCase() + lang.language.slice(1))
				.join(", ");

			const choices = character._languageProficiencies
				.filter(lang => lang.language === "choice")
				.map(lang => `${lang.count} of your choice`)
				.join(", ");

			const allLanguages = [languages, choices].filter(Boolean).join(", ");

			if (allLanguages) {
				proficienciesHtml += `<div class="proficiency-section">
					<h4>Languages</h4>
					<p>${allLanguages}</p>
				</div>`;
			}
		}

		// Skills
		if (character._skillProficiencies && character._skillProficiencies.length > 0) {
			const skills = character._skillProficiencies
				.filter(skill => skill.skill !== "choice")
				.map(skill => skill.skill.charAt(0).toUpperCase() + skill.skill.slice(1))
				.join(", ");

			const choices = character._skillProficiencies
				.filter(skill => skill.skill === "choice")
				.map(skill => `${skill.count} of your choice`)
				.join(", ");

			const allSkills = [skills, choices].filter(Boolean).join(", ");

			if (allSkills) {
				proficienciesHtml += `<div class="proficiency-section">
					<h4>Skill Proficiencies</h4>
					<p>${allSkills}</p>
				</div>`;
			}
		}

		// Weapons
		if (character._weaponProficiencies && character._weaponProficiencies.length > 0) {
			const weapons = character._weaponProficiencies
				.map(weapon => weapon.weapon.charAt(0).toUpperCase() + weapon.weapon.slice(1))
				.join(", ");

			if (weapons) {
				proficienciesHtml += `<div class="proficiency-section">
					<h4>Weapon Proficiencies</h4>
					<p>${weapons}</p>
				</div>`;
			}
		}

		// Armor
		if (character._armorProficiencies && character._armorProficiencies.length > 0) {
			const armor = character._armorProficiencies
				.map(armor => armor.armor.charAt(0).toUpperCase() + armor.armor.slice(1))
				.join(", ");

			if (armor) {
				proficienciesHtml += `<div class="proficiency-section">
					<h4>Armor Proficiencies</h4>
					<p>${armor}</p>
				</div>`;
			}
		}

		// Tools
		if (character._toolProficiencies && character._toolProficiencies.length > 0) {
			const tools = character._toolProficiencies
				.map(tool => tool.tool.charAt(0).toUpperCase() + tool.tool.slice(1))
				.join(", ");

			if (tools) {
				proficienciesHtml += `<div class="proficiency-section">
					<h4>Tool Proficiencies</h4>
					<p>${tools}</p>
				</div>`;
			}
		}

		if (!proficienciesHtml) return "";

		return `<tr><td colspan="6">
			<div class="character-proficiencies">
				<h3>Proficiencies</h3>
				${proficienciesHtml}
			</div>
		</td></tr>`;
	}

	/**
	 * Checks if character has any proficiencies to display
	 * @param {Object} character - Character data
	 * @returns {boolean} True if character has proficiencies
	 */
	static _hasProficiencies (character) {
		return (character._languageProficiencies && character._languageProficiencies.length > 0) ||
			   (character._skillProficiencies && character._skillProficiencies.length > 0) ||
			   (character._weaponProficiencies && character._weaponProficiencies.length > 0) ||
			   (character._armorProficiencies && character._armorProficiencies.length > 0) ||
			   (character._toolProficiencies && character._toolProficiencies.length > 0);
	}

	/**
	 * Renders spellcasting information
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for spellcasting
	 */
	static _getSpellcasting (character) {
		const spellcasting = character.spellcasting;
		let spellSlotsHtml = "";
		let spellsHtml = "";

		// Render spell slots
		if (spellcasting.slots) {
			const slotRows = [];
			for (let level = 1; level <= 9; level++) {
				const slot = spellcasting.slots[level.toString()];
				if (slot && slot.max > 0) {
					slotRows.push(`<div>Level ${level}: ${slot.max - slot.used}/${slot.max}</div>`);
				}
			}
			if (slotRows.length > 0) {
				spellSlotsHtml = `<div class="spell-slots">
					<h4>Spell Slots</h4>
					${slotRows.join("")}
				</div>`;
			}
		}

		// Render known/prepared spells
		if (spellcasting.known && spellcasting.known.length > 0) {
			spellsHtml += `<div class="spells-known">
				<h4>Spells Known</h4>
				<div>${spellcasting.known.join(", ")}</div>
			</div>`;
		}

		if (spellcasting.prepared && spellcasting.prepared.length > 0) {
			spellsHtml += `<div class="spells-prepared">
				<h4>Spells Prepared</h4>
				<div>${spellcasting.prepared.join(", ")}</div>
			</div>`;
		}

		if (!spellSlotsHtml && !spellsHtml) {
			return "";
		}

		return `<tr><td colspan="6">
			<div class="character-spellcasting">
				<h3>Spellcasting</h3>
				${spellSlotsHtml}
				${spellsHtml}
			</div>
		</td></tr>`;
	}

	/**
	 * Renders custom features
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for custom features
	 */
	static _getCustomFeatures (character) {
		const featuresHtml = character.customFeatures.map(feature => {
			return `<div class="custom-feature">
				<h4>${feature.name}</h4>
				<p>${feature.description || ""}</p>
			</div>`;
		}).join("");

		return `<tr><td colspan="6">
			<div class="character-custom-features">
				<h3>Custom Features</h3>
				${featuresHtml}
			</div>
		</td></tr>`;
	}

	/**
	 * Renders custom notes
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for custom notes
	 */
	static _getCustomNotes (character) {
		return `<tr><td colspan="6">
			<div class="character-notes">
				<h3>Notes</h3>
				<p>${character.customNotes}</p>
			</div>
		</td></tr>`;
	}

	/**
	 * Checks if character has spellcasting capabilities
	 * @param {Object} character - Character data
	 * @returns {boolean} True if character has spellcasting
	 */
	static _hasSpellcasting (character) {
		const spellcasting = character.spellcasting;
		if (!spellcasting) return false;

		// Check for spell slots
		if (spellcasting.slots) {
			for (let level = 1; level <= 9; level++) {
				const slot = spellcasting.slots[level.toString()];
				if (slot && slot.max > 0) return true;
			}
		}

		// Check for known or prepared spells
		if (spellcasting.known && spellcasting.known.length > 0) return true;
		if (spellcasting.prepared && spellcasting.prepared.length > 0) return true;

		return false;
	}

	/**
	 * Gets a compact character display for lists
	 * @param {Object} character - Character data
	 * @returns {string} Compact character description
	 */
	static getCompactCharacterString (character) {
		const level = character.level || 1;
		const raceName = character.race ? character.race.name : "Unknown";
		const className = character.class ? character.class.name : "Unknown";

		return `Level ${level} ${raceName} ${className}`;
	}

	/**
	 * Gets character display name with level
	 * @param {Object} character - Character data
	 * @returns {string} Character display name
	 */
	static getCharacterDisplayName (character) {
		const level = character.level || 1;
		return `${character.name} (Level ${level})`;
	}
}

// Export for use in other modules
globalThis.RenderCharacters = RenderCharacters;
