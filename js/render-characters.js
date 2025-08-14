"use strict";

/**
 * Character rendering utilities for 5etools player character system.
 * Handles the display and formatting of character data in stat blocks and lists.
 */

class RenderCharacters {
	/**
	 * Renders a complete character stat block
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

		// Ability scores
		if (character.abilityScores) {
			$tbody.append(this._getAbilityScores(character));
		}

		// Hit points
		if (character.hitPoints) {
			$tbody.append(this._getHitPoints(character));
		}

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
		const className = character.class ? character.class.name : "Unknown";
		const subclassName = character.class?.subclass?.name ? ` (${character.class.subclass.name})` : "";

		return `<tr><td colspan="6">
			<div class="character-statblock">
				<div class="character-header">
					<h1 class="character-name">${character.name}</h1>
					<div class="character-meta">
						Level ${level} ${raceName} ${className}${subclassName}
					</div>
				</div>
			</div>
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
			<div class="character-basic-info">
				<div class="character-info-grid">
					<div><strong>Background:</strong> ${backgroundName}</div>
					<div><strong>Proficiency Bonus:</strong> +${proficiencyBonus}</div>
				</div>
			</div>
		</td></tr>`;
	}

	/**
	 * Renders ability scores with modifiers
	 * @param {Object} character - Character data
	 * @returns {string} HTML string for ability scores
	 */
	static _getAbilityScores (character) {
		const abilities = ["str", "dex", "con", "int", "wis", "cha"];
		const abilityNames = {
			str: "Strength",
			dex: "Dexterity",
			con: "Constitution",
			int: "Intelligence",
			wis: "Wisdom",
			cha: "Charisma"
		};

		const abilityRows = abilities.map(ability => {
			const score = character.abilityScores[ability] || 10;
			const modifier = CharacterUtil.getAbilityModifier(score);
			const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;

			return `<div class="ability-score">
				<div class="ability-name">${abilityNames[ability]}</div>
				<div class="ability-value">${score} (${modifierStr})</div>
			</div>`;
		}).join("");

		return `<tr><td colspan="6">
			<div class="character-abilities">
				<h3>Ability Scores</h3>
				<div class="character-abilities-grid">
					${abilityRows}
				</div>
			</div>
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
