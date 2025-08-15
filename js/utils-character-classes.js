/**
 * Utility class for handling character class data and operations
 */
class CharacterClassUtil {
	static _classData = null;
	static _classDataPromise = null;

	/**
	 * Load and cache class data
	 * @returns {Promise<Array>} Array of class objects
	 */
	static async pGetClasses() {
		if (this._classData) return this._classData;
		if (this._classDataPromise) return this._classDataPromise;

		this._classDataPromise = this._pLoadClasses();
		this._classData = await this._classDataPromise;
		return this._classData;
	}

	/**
	 * Internal method to load class data from files
	 * @private
	 */
	static async _pLoadClasses() {
		try {
			// Use the official 5etools data loading method
			const classData = await DataUtil.class.loadRawJSON();

			// Process classes and attach their subclasses
			const allClasses = [];

			if (classData.class && Array.isArray(classData.class)) {
				classData.class.forEach(cls => {
					// Attach subclasses if they exist
					if (classData.subclass && Array.isArray(classData.subclass)) {
						const classSubclasses = classData.subclass.filter(sc =>
							sc.className === cls.name && sc.classSource === cls.source
						);
						if (classSubclasses.length > 0) {
							cls.subclasses = classSubclasses;
						} else {
							cls.subclasses = [];
						}
					} else {
						cls.subclasses = [];
					}
					allClasses.push(cls);
				});
			}

			console.log(`Loaded ${allClasses.length} classes with subclasses`);
			return allClasses;
		} catch (error) {
			console.error("Failed to load class data:", error);
			return [];
		}
	}

	/**
	 * Get a specific class by name and source
	 * @param {string} name - Class name
	 * @param {string} source - Source abbreviation
	 * @returns {Promise<Object|null>} Class object or null if not found
	 */
	static async pGetClass(name, source) {
		const classes = await this.pGetClasses();
		return classes.find(cls => cls.name === name && cls.source === source) || null;
	}

	/**
	 * Get class summary information for display
	 * @param {string} name - Class name
	 * @param {string} source - Source abbreviation
	 * @returns {Promise<Object|null>} Class summary or null
	 */
	static async pGetClassSummary(name, source) {
		const cls = await this.pGetClass(name, source);
		if (!cls) return null;

		return {
			name: cls.name,
			source: cls.source,
			hitDie: cls.hd?.faces || 6,
			primaryAbility: cls.primaryAbility || [],
			savingThrows: cls.proficiency || [],
			skillProficiencies: cls.skillProficiencies || [],
			startingProficiencies: cls.startingProficiencies || {},
			startingEquipment: cls.startingEquipment || {},
			features: this._getLevel1Features(cls),
			subclasses: cls.subclasses || [],
			spellcasting: cls.spellcastingAbility ? {
				ability: cls.spellcastingAbility,
				ritual: cls.casterProgression === "full" || cls.casterProgression === "1/2" || cls.casterProgression === "1/3"
			} : null
		};
	}

	/**
	 * Get level 1 features for a class
	 * @private
	 */
	static _getLevel1Features(cls) {
		if (!cls.classFeatures) return [];

		const level1Features = [];

		// Look for level 1 features in classFeatures array
		for (const feature of cls.classFeatures) {
			if (feature.level === 1) {
				level1Features.push({
					name: feature.name,
					source: feature.source || cls.source,
					entries: feature.entries || []
				});
			}
		}

		return level1Features;
	}

	/**
	 * Apply class to character data
	 * @param {Object} characterData - Character data object
	 * @param {string} className - Class name
	 * @param {string} classSource - Class source
	 * @param {string|null} subclassName - Subclass name (optional)
	 * @returns {Promise<Object>} Updated character data
	 */
	static async pApplyClassToCharacter(characterData, className, classSource, subclassName = null) {
		const cls = await this.pGetClass(className, classSource);
		if (!cls) {
			throw new Error(`Class not found: ${className} (${classSource})`);
		}

		// Create a copy of character data
		const updatedCharacter = {...characterData};

		// Set class information
		updatedCharacter.class = {
			name: className,
			source: classSource
		};

		// Set subclass if provided
		if (subclassName && cls.subclasses) {
			const subclass = cls.subclasses.find(sc => sc.name === subclassName);
			if (subclass) {
				updatedCharacter.class.subclass = {
					name: subclassName,
					source: subclass.source || classSource
				};
			}
		}

		// Apply hit die
		if (cls.hd?.faces) {
			updatedCharacter.hitDie = cls.hd.faces;
		}

		// Calculate starting hit points
		const level = updatedCharacter.level || 1;
		const hitDie = cls.hd?.faces || 6;
		const conMod = this._getAbilityModifier(updatedCharacter.abilityScores?.con || 10);

		// At level 1, you get max hit die + con modifier
		let maxHp = hitDie + conMod;

		// For levels above 1, add average hit die + con modifier per level
		if (level > 1) {
			const avgHitDie = Math.floor(hitDie / 2) + 1;
			maxHp += (avgHitDie + conMod) * (level - 1);
		}

		updatedCharacter.hitPoints = {
			max: Math.max(1, maxHp), // Minimum 1 HP
			current: Math.max(1, maxHp),
			temp: 0
		};

		// Apply proficiency bonus
		updatedCharacter.proficiencyBonus = Math.ceil(level / 4) + 1;

		// Apply saving throw proficiencies
		if (cls.proficiency) {
			updatedCharacter.savingThrowProficiencies = [...(cls.proficiency || [])];
		}

		// Apply skill proficiencies (if any are automatically granted)
		if (cls.skillProficiencies) {
			updatedCharacter.skillProficiencies = updatedCharacter.skillProficiencies || [];
			// Note: Most classes give skill choices, not automatic proficiencies
			// This would need to be expanded to handle skill choices
		}

		// Apply starting proficiencies
		if (cls.startingProficiencies) {
			updatedCharacter.proficiencies = updatedCharacter.proficiencies || {};

			if (cls.startingProficiencies.armor) {
				updatedCharacter.proficiencies.armor = [...(cls.startingProficiencies.armor || [])];
			}

			if (cls.startingProficiencies.weapons) {
				updatedCharacter.proficiencies.weapons = [...(cls.startingProficiencies.weapons || [])];
			}

			if (cls.startingProficiencies.tools) {
				updatedCharacter.proficiencies.tools = [...(cls.startingProficiencies.tools || [])];
			}
		}

		// Apply level 1 class features
		const level1Features = this._getLevel1Features(cls);
		if (level1Features.length > 0) {
			updatedCharacter.classFeatures = updatedCharacter.classFeatures || [];
			updatedCharacter.classFeatures.push(...level1Features);
		}

		// Handle spellcasting classes
		if (cls.spellcastingAbility) {
			updatedCharacter.spellcasting = {
				ability: cls.spellcastingAbility,
				slots: this._calculateSpellSlots(cls, level),
				known: [],
				prepared: []
			};
		}

		return updatedCharacter;
	}

	/**
	 * Calculate ability modifier
	 * @private
	 */
	static _getAbilityModifier(score) {
		return Math.floor((score - 10) / 2);
	}

	/**
	 * Calculate spell slots for a spellcasting class
	 * @private
	 */
	static _calculateSpellSlots(cls, level) {
		if (!cls.spellcastingAbility) return {};

		// This is a simplified spell slot calculation
		// In a full implementation, you'd need to handle different caster progressions
		const slots = {};

		if (cls.casterProgression === "full") {
			// Full casters like Wizard, Sorcerer
			if (level >= 1) slots["1"] = {max: 2, used: 0};
			if (level >= 3) slots["2"] = {max: 1, used: 0};
			if (level >= 5) slots["3"] = {max: 1, used: 0};
			// ... continue for higher levels
		} else if (cls.casterProgression === "1/2") {
			// Half casters like Paladin, Ranger
			if (level >= 2) slots["1"] = {max: 1, used: 0};
			if (level >= 5) slots["2"] = {max: 1, used: 0};
			// ... continue for higher levels
		} else if (cls.casterProgression === "1/3") {
			// Third casters like Eldritch Knight
			if (level >= 3) slots["1"] = {max: 1, used: 0};
			// ... continue for higher levels
		}

		return slots;
	}

	/**
	 * Get available subclasses for a class
	 * @param {string} className - Class name
	 * @param {string} classSource - Class source
	 * @returns {Promise<Array>} Array of subclass objects
	 */
	static async pGetSubclasses(className, classSource) {
		const cls = await this.pGetClass(className, classSource);
		return cls?.subclasses || [];
	}
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
	module.exports = CharacterClassUtil;
} else if (typeof window !== "undefined") {
	window.CharacterClassUtil = CharacterClassUtil;
}
