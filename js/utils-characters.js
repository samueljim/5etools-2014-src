/**
 * Character management utilities for 5etools player character system.
 * Provides data models, validation, and storage functionality for player characters.
 */

"use strict";

// Character data model and validation utilities
globalThis.CharacterUtil = class {
	// Storage key for character data
	static STORAGE_KEY = "CHARACTERS_HOMEBREW";

	/**
	 * Character data model interface
	 * Defines the structure and validation for player character data
	 */
	static getDefaultCharacterData () {
		return {
			name: "",
			source: "HOMEBREW", // Always homebrew for player characters
			level: 1,
			race: {
				name: null,
				source: null,
				subrace: null
			},
			class: {
				name: null,
				source: null,
				subclass: {
					name: null,
					source: null
				}
			},
			background: {
				name: null,
				source: null
			},
			abilityScores: {
				str: 10,
				dex: 10,
				con: 10,
				int: 10,
				wis: 10,
				cha: 10
			},
			hitPoints: {
				max: 0,
				current: 0,
				temp: 0
			},
			spellcasting: {
				slots: {
					"1": {max: 0, used: 0},
					"2": {max: 0, used: 0},
					"3": {max: 0, used: 0},
					"4": {max: 0, used: 0},
					"5": {max: 0, used: 0},
					"6": {max: 0, used: 0},
					"7": {max: 0, used: 0},
					"8": {max: 0, used: 0},
					"9": {max: 0, used: 0}
				},
				known: [],
				prepared: []
			},
			customNotes: "",
			customFeatures: [],
			_meta: {
				created: null,
				lastModified: null,
				uniqueId: null
			}
		};
	}

	/**
	 * Validates character data structure
	 * @param {Object} character - Character data to validate
	 * @returns {Object} Validation result with isValid boolean and errors array
	 */
	static validateCharacter (character) {
		const errors = [];

		if (!character) {
			errors.push("Character data is required");
			return {isValid: false, errors};
		}

		// Validate required fields
		if (!character.name || typeof character.name !== "string" || character.name.trim() === "") {
			errors.push("Character name is required");
		}

		if (!Number.isInteger(character.level) || character.level < 1 || character.level > 20) {
			errors.push("Character level must be an integer between 1 and 20");
		}

		// Validate ability scores
		if (!character.abilityScores) {
			errors.push("Ability scores are required");
		} else {
			const abilities = ["str", "dex", "con", "int", "wis", "cha"];
			for (const ability of abilities) {
				const score = character.abilityScores[ability];
				if (!Number.isInteger(score) || score < 1 || score > 30) {
					errors.push(`${ability.toUpperCase()} score must be an integer between 1 and 30`);
				}
			}
		}

		// Validate hit points
		if (!character.hitPoints) {
			errors.push("Hit points data is required");
		} else {
			if (!Number.isInteger(character.hitPoints.max) || character.hitPoints.max < 0) {
				errors.push("Maximum hit points must be a non-negative integer");
			}
			if (!Number.isInteger(character.hitPoints.current) || character.hitPoints.current < 0) {
				errors.push("Current hit points must be a non-negative integer");
			}
			if (!Number.isInteger(character.hitPoints.temp) || character.hitPoints.temp < 0) {
				errors.push("Temporary hit points must be a non-negative integer");
			}
		}

		// Validate spell slots if present
		if (character.spellcasting && character.spellcasting.slots) {
			for (let level = 1; level <= 9; level++) {
				const slot = character.spellcasting.slots[level.toString()];
				if (slot) {
					if (!Number.isInteger(slot.max) || slot.max < 0) {
						errors.push(`Spell slot level ${level} max must be a non-negative integer`);
					}
					if (!Number.isInteger(slot.used) || slot.used < 0) {
						errors.push(`Spell slot level ${level} used must be a non-negative integer`);
					}
					if (slot.used > slot.max) {
						errors.push(`Spell slot level ${level} used cannot exceed max`);
					}
				}
			}
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Creates a new character with default values and unique ID
	 * @param {Object} overrides - Optional overrides for default values
	 * @returns {Object} New character data
	 */
	static createNewCharacter (overrides = {}) {
		const character = {
			...this.getDefaultCharacterData(),
			...overrides
		};

		// Generate unique ID and timestamps
		character._meta.uniqueId = CryptUtil.uid();
		character._meta.created = new Date().toISOString();
		character._meta.lastModified = new Date().toISOString();

		return character;
	}

	/**
	 * Updates character's last modified timestamp
	 * @param {Object} character - Character to update
	 * @returns {Object} Updated character
	 */
	static updateLastModified (character) {
		if (!character._meta) {
			character._meta = {};
		}
		character._meta.lastModified = new Date().toISOString();
		return character;
	}

	/**
	 * Calculates ability modifier from ability score
	 * @param {number} score - Ability score
	 * @returns {number} Ability modifier
	 */
	static getAbilityModifier (score) {
		return Math.floor((score - 10) / 2);
	}

	/**
	 * Calculates proficiency bonus based on character level
	 * @param {number} level - Character level
	 * @returns {number} Proficiency bonus
	 */
	static getProficiencyBonus (level) {
		return Math.ceil(level / 4) + 1;
	}

	/**
	 * Deep clones character data to prevent mutation
	 * @param {Object} character - Character to clone
	 * @returns {Object} Cloned character
	 */
	static cloneCharacter (character) {
		return MiscUtil.copyFast(character);
	}
};

/**
 * Character storage management using BrewUtil2 patterns
 * Handles persistence, retrieval, and management of character data
 */
globalThis.CharacterStorageUtil = class {
	static _cache = null;
	static _isDirty = false;

	/**
	 * Loads all characters from storage, adding default characters if none exist.
	 * @returns {Promise<Array>} Array of character objects
	 */
	static async pLoadCharacters () {
		if (this._cache && !this._isDirty) {
			return this._cache;
		}

		try {
			let stored = await StorageUtil.pGet(CharacterUtil.STORAGE_KEY);

			// If no characters are stored, add some default ones
			if (!stored || stored.length === 0) {
				stored = this.getDefaultCharacters();
				await this.pSaveCharacters(stored);
			}

			this._cache = stored;
			this._isDirty = false;
			return this._cache;
		} catch (error) {
			console.error("Failed to load characters from storage:", error);
			this._cache = this.getDefaultCharacters(); // Fallback to defaults on error
			return this._cache;
		}
	}

	/**
	 * Returns an array of default characters for testing and initial setup.
	 * @returns {Array} An array of character objects.
	 */
	static getDefaultCharacters () {
		return [
			CharacterUtil.createNewCharacter({
				name: "Evelyn Reed",
				level: 5,
				race: {name: "Human", source: "PHB"},
				class: {name: "Rogue", source: "PHB", subclass: {name: "Thief", source: "PHB"}},
				background: {name: "Urchin", source: "PHB"},
				abilityScores: {str: 10, dex: 18, con: 14, int: 12, wis: 11, cha: 14},
				hitPoints: {max: 38, current: 38, temp: 0},
				speed: "30 ft.",
				savingThrows: {dex: true, int: true},
				skills: {
					stealth: true,
					thieves_tools: true,
					acrobatics: true,
					insight: true
				},
				equipment: [
					{
						name: "Rapier",
						type: "weapon",
						damage: "1d8",
						damageType: "piercing",
						ability: "dex",
						proficient: true,
						enchantment: 0
					},
					{
						name: "Leather Armor",
						type: "armor",
						ac: 11
					},
					{
						name: "Thieves' Tools",
						type: "equipment"
					}
				],
				features: [
					{
						name: "Sneak Attack",
						description: "Once per turn, you can deal an extra 3d6 damage to one creature you hit with an attack if you have advantage on the attack roll."
					},
					{
						name: "Thieves' Cant",
						description: "You know thieves' cant, a secret mix of dialect, jargon, and code."
					}
				]
			}),
			CharacterUtil.createNewCharacter({
				name: "Grommash Hellscream",
				level: 8,
				race: {name: "Orc", source: "VGM"},
				class: {name: "Barbarian", source: "PHB", subclass: {name: "Path of the Berserker", source: "PHB"}},
				background: {name: "Outlander", source: "PHB"},
				abilityScores: {str: 20, dex: 14, con: 18, int: 8, wis: 12, cha: 10},
				hitPoints: {max: 92, current: 92, temp: 0},
				speed: "30 ft., climb 30 ft.",
				savingThrows: {str: true, con: true},
				skills: {
					athletics: true,
					intimidation: true,
					survival: true,
					perception: true
				},
				equipment: [
					{
						name: "Greataxe",
						type: "weapon",
						damage: "1d12",
						damageType: "slashing",
						ability: "str",
						proficient: true,
						enchantment: 1
					},
					{
						name: "Javelin",
						type: "weapon",
						damage: "1d6",
						damageType: "piercing",
						ability: "str",
						proficient: true,
						enchantment: 0
					},
					{
						name: "Chain Mail",
						type: "armor",
						ac: 16
					}
				],
				features: [
					{
						name: "Rage",
						description: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action."
					},
					{
						name: "Reckless Attack",
						description: "You can throw aside all concern for defense to attack with fierce desperation."
					},
					{
						name: "Danger Sense",
						description: "You have advantage on Dexterity saving throws against effects that you can see."
					}
				]
			}),
			CharacterUtil.createNewCharacter({
				name: "Lyralei Moonwhisper",
				level: 6,
				race: {name: "Elf", source: "PHB", subrace: "High Elf"},
				class: {name: "Wizard", source: "PHB", subclass: {name: "School of Evocation", source: "PHB"}},
				background: {name: "Sage", source: "PHB"},
				abilityScores: {str: 8, dex: 14, con: 13, int: 18, wis: 12, cha: 10},
				hitPoints: {max: 42, current: 42, temp: 0},
				speed: "30 ft.",
				savingThrows: {int: true, wis: true},
				skills: {
					arcana: true,
					history: true,
					investigation: true,
					insight: true
				},
				spellcasting: {
					slots: {
						"1": {max: 4, used: 1},
						"2": {max: 3, used: 0},
						"3": {max: 3, used: 2}
					},
					known: [
						{name: "Fireball", level: 3},
						{name: "Magic Missile", level: 1},
						{name: "Shield", level: 1},
						{name: "Counterspell", level: 3},
						{name: "Misty Step", level: 2}
					]
				},
				equipment: [
					{
						name: "Quarterstaff",
						type: "weapon",
						damage: "1d6",
						damageType: "bludgeoning",
						ability: "str",
						proficient: true,
						enchantment: 0
					},
					{
						name: "Arcane Focus",
						type: "equipment"
					},
					{
						name: "Spellbook",
						type: "equipment"
					}
				],
				features: [
					{
						name: "Spellcasting",
						description: "You are a 6th-level spellcaster. Your spellcasting ability is Intelligence (spell save DC 15, +7 to hit with spell attacks)."
					},
					{
						name: "Arcane Recovery",
						description: "You have learned to regain some of your magical energy by studying your spellbook."
					},
					{
						name: "Sculpt Spells",
						description: "You can create pockets of relative safety within the effects of your evocation spells."
					}
				]
			})
		];
	}

	/**
	 * Saves all characters to storage
	 * @param {Array} characters - Array of character objects to save
	 * @returns {Promise<void>}
	 */
	static async pSaveCharacters (characters) {
		try {
			// Validate all characters before saving
			const validationResults = characters.map(char => CharacterUtil.validateCharacter(char));
			const invalidCharacters = validationResults.filter(result => !result.isValid);

			if (invalidCharacters.length > 0) {
				console.warn("Some characters failed validation:", invalidCharacters);
				// Continue saving valid characters, but log warnings
			}

			await StorageUtil.pSet(CharacterUtil.STORAGE_KEY, characters);
			this._cache = characters;
			this._isDirty = false;
		} catch (error) {
			console.error("Failed to save characters to storage:", error);
			throw error;
		}
	}

	/**
	 * Adds a new character
	 * @param {Object} character - Character to add
	 * @returns {Promise<Object>} Added character with generated ID
	 */
	static async pAddCharacter (character) {
		const characters = await this.pLoadCharacters();

		// Ensure character has required metadata
		if (!character._meta || !character._meta.uniqueId) {
			character = CharacterUtil.createNewCharacter(character);
		} else {
			character = CharacterUtil.updateLastModified(character);
		}

		// Validate character
		const validation = CharacterUtil.validateCharacter(character);
		if (!validation.isValid) {
			throw new Error(`Character validation failed: ${validation.errors.join(", ")}`);
		}

		characters.push(character);
		await this.pSaveCharacters(characters);

		return character;
	}

	/**
	 * Updates an existing character
	 * @param {Object} character - Character to update
	 * @returns {Promise<Object>} Updated character
	 */
	static async pUpdateCharacter (character) {
		const characters = await this.pLoadCharacters();

		if (!character._meta || !character._meta.uniqueId) {
			throw new Error("Character must have a unique ID to update");
		}

		// Validate character
		const validation = CharacterUtil.validateCharacter(character);
		if (!validation.isValid) {
			throw new Error(`Character validation failed: ${validation.errors.join(", ")}`);
		}

		const index = characters.findIndex(c => c._meta.uniqueId === character._meta.uniqueId);
		if (index === -1) {
			throw new Error("Character not found");
		}

		character = CharacterUtil.updateLastModified(character);
		characters[index] = character;
		await this.pSaveCharacters(characters);

		return character;
	}

	/**
	 * Removes a character by unique ID
	 * @param {string} uniqueId - Unique ID of character to remove
	 * @returns {Promise<boolean>} True if character was removed
	 */
	static async pRemoveCharacter (uniqueId) {
		const characters = await this.pLoadCharacters();
		const index = characters.findIndex(c => c._meta.uniqueId === uniqueId);

		if (index === -1) {
			return false;
		}

		characters.splice(index, 1);
		await this.pSaveCharacters(characters);

		return true;
	}

	/**
	 * Gets a character by unique ID
	 * @param {string} uniqueId - Unique ID of character to retrieve
	 * @returns {Promise<Object|null>} Character object or null if not found
	 */
	static async pGetCharacter (uniqueId) {
		const characters = await this.pLoadCharacters();
		return characters.find(c => c._meta.uniqueId === uniqueId) || null;
	}

	/**
	 * Exports character data as JSON
	 * @param {string} uniqueId - Unique ID of character to export
	 * @returns {Promise<string>} JSON string of character data
	 */
	static async pExportCharacter (uniqueId) {
		const character = await this.pGetCharacter(uniqueId);
		if (!character) {
			throw new Error("Character not found");
		}

		return JSON.stringify(character, null, 2);
	}

	/**
	 * Imports character data from JSON
	 * @param {string} jsonData - JSON string of character data
	 * @returns {Promise<Object>} Imported character
	 */
	static async pImportCharacter (jsonData) {
		let character;

		try {
			character = JSON.parse(jsonData);
		} catch (error) {
			throw new Error("Invalid JSON format");
		}

		// Validate imported character
		const validation = CharacterUtil.validateCharacter(character);
		if (!validation.isValid) {
			throw new Error(`Imported character validation failed: ${validation.errors.join(", ")}`);
		}

		// Generate new unique ID to avoid conflicts
		character._meta = character._meta || {};
		character._meta.uniqueId = CryptUtil.uid();
		character._meta.lastModified = new Date().toISOString();

		return this.pAddCharacter(character);
	}

	/**
	 * Clears the cache, forcing reload on next access
	 */
	static clearCache () {
		this._cache = null;
		this._isDirty = true;
	}

	/**
	 * Gets storage statistics
	 * @returns {Promise<Object>} Storage statistics
	 */
	static async pGetStorageStats () {
		const characters = await this.pLoadCharacters();

		return {
			totalCharacters: characters.length,
			storageKey: CharacterUtil.STORAGE_KEY,
			lastAccessed: new Date().toISOString()
		};
	}
};
