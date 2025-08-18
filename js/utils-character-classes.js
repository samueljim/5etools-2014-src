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

		// Extract primary abilities from the class data
		let primaryAbilities = [];
		if (cls.primaryAbility) {
			primaryAbilities = Array.isArray(cls.primaryAbility) ? cls.primaryAbility : [cls.primaryAbility];
		}

		// Get skill proficiency choices
		let skillChoices = [];
		if (cls.startingProficiencies?.skills) {
			cls.startingProficiencies.skills.forEach(skillEntry => {
				if (skillEntry.choose) {
					skillChoices.push({
						from: skillEntry.choose.from || [],
						count: skillEntry.choose.count || 1
					});
				}
			});
		}

		return {
			name: cls.name,
			source: cls.source,
			hitDie: cls.hd?.faces || 6,
			primaryAbilities: primaryAbilities,
			savingThrowProficiencies: cls.proficiency || [],
			skillProficiencyChoices: skillChoices,
			startingProficiencies: cls.startingProficiencies || {},
			startingEquipment: cls.startingEquipment || {},
			level1Features: this._getLevel1Features(cls),
			subclasses: cls.subclasses || [],
			spellcasting: cls.spellcastingAbility ? {
				ability: cls.spellcastingAbility,
				progression: cls.casterProgression || "full",
				ritual: cls.casterProgression === "full" || cls.casterProgression === "1/2" || cls.casterProgression === "1/3"
			} : null,
			multiclassing: cls.multiclassing || null
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
		// Class features are stored as UIDs like "Fighting Style|Fighter||1"
		for (const featureUid of cls.classFeatures) {
			try {
				// Handle both string UIDs and object references
				const uid = typeof featureUid === 'string' ? featureUid : featureUid.classFeature;
				if (!uid) continue;

				// Unpack the UID to get feature details
				const unpacked = DataUtil.class.unpackUidClassFeature(uid);

				// Only include level 1 features
				if (unpacked.level === 1) {
					level1Features.push({
						name: unpacked.name,
						className: unpacked.className,
						classSource: unpacked.classSource,
						level: unpacked.level,
						source: unpacked.source,
						uid: uid,
						// Note: The actual feature content would need to be loaded separately
						// from the class feature data files if needed for display
					});
				}
			} catch (error) {
				console.warn("Failed to parse class feature UID:", featureUid, error);
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

			// Handle skill proficiencies (usually choices, but store the options)
			if (cls.startingProficiencies.skills) {
				updatedCharacter.skillProficiencyChoices = cls.startingProficiencies.skills;
				// Note: Actual skill selection would need to be handled in character creation UI
			}
		}

		// Apply starting equipment
		if (cls.startingEquipment) {
			updatedCharacter.startingEquipment = {
				default: cls.startingEquipment.default || [],
				goldAlternative: cls.startingEquipment.goldAlternative || null,
				additionalFromBackground: cls.startingEquipment.additionalFromBackground || false
			};
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

		const slots = {};

		// Use the standard D&D 5e spell slot progression tables
		if (cls.casterProgression === "full") {
			// Full casters like Wizard, Sorcerer, Cleric, Druid, Bard
			const fullCasterSlots = [
				[2], // Level 1
				[3], // Level 2
				[4, 2], // Level 3
				[4, 3], // Level 4
				[4, 3, 2], // Level 5
				[4, 3, 3], // Level 6
				[4, 3, 3, 1], // Level 7
				[4, 3, 3, 2], // Level 8
				[4, 3, 3, 3, 1], // Level 9
				[4, 3, 3, 3, 2], // Level 10
				[4, 3, 3, 3, 2, 1], // Level 11
				[4, 3, 3, 3, 2, 1], // Level 12
				[4, 3, 3, 3, 2, 1, 1], // Level 13
				[4, 3, 3, 3, 2, 1, 1], // Level 14
				[4, 3, 3, 3, 2, 1, 1, 1], // Level 15
				[4, 3, 3, 3, 2, 1, 1, 1], // Level 16
				[4, 3, 3, 3, 2, 1, 1, 1, 1], // Level 17
				[4, 3, 3, 3, 3, 1, 1, 1, 1], // Level 18
				[4, 3, 3, 3, 3, 2, 1, 1, 1], // Level 19
				[4, 3, 3, 3, 3, 2, 2, 1, 1] // Level 20
			];

			if (level >= 1 && level <= 20) {
				const levelSlots = fullCasterSlots[level - 1];
				for (let i = 0; i < levelSlots.length; i++) {
					slots[`${i + 1}`] = {max: levelSlots[i], used: 0};
				}
			}
		} else if (cls.casterProgression === "1/2") {
			// Half casters like Paladin, Ranger (start at level 2)
			const halfCasterSlots = [
				[], // Level 1 - no spells
				[2], // Level 2
				[3], // Level 3
				[3], // Level 4
				[4, 2], // Level 5
				[4, 2], // Level 6
				[4, 3], // Level 7
				[4, 3], // Level 8
				[4, 3, 2], // Level 9
				[4, 3, 2], // Level 10
				[4, 3, 3], // Level 11
				[4, 3, 3], // Level 12
				[4, 3, 3, 1], // Level 13
				[4, 3, 3, 1], // Level 14
				[4, 3, 3, 2], // Level 15
				[4, 3, 3, 2], // Level 16
				[4, 3, 3, 3, 1], // Level 17
				[4, 3, 3, 3, 1], // Level 18
				[4, 3, 3, 3, 2], // Level 19
				[4, 3, 3, 3, 2] // Level 20
			];

			if (level >= 1 && level <= 20) {
				const levelSlots = halfCasterSlots[level - 1];
				for (let i = 0; i < levelSlots.length; i++) {
					slots[`${i + 1}`] = {max: levelSlots[i], used: 0};
				}
			}
		} else if (cls.casterProgression === "1/3") {
			// Third casters like Eldritch Knight, Arcane Trickster (start at level 3)
			const thirdCasterSlots = [
				[], // Level 1 - no spells
				[], // Level 2 - no spells
				[2], // Level 3
				[3], // Level 4
				[3], // Level 5
				[3], // Level 6
				[4, 2], // Level 7
				[4, 2], // Level 8
				[4, 2], // Level 9
				[4, 3], // Level 10
				[4, 3], // Level 11
				[4, 3], // Level 12
				[4, 3, 2], // Level 13
				[4, 3, 2], // Level 14
				[4, 3, 2], // Level 15
				[4, 3, 3], // Level 16
				[4, 3, 3], // Level 17
				[4, 3, 3], // Level 18
				[4, 3, 3, 1], // Level 19
				[4, 3, 3, 1] // Level 20
			];

			if (level >= 1 && level <= 20) {
				const levelSlots = thirdCasterSlots[level - 1];
				for (let i = 0; i < levelSlots.length; i++) {
					slots[`${i + 1}`] = {max: levelSlots[i], used: 0};
				}
			}
		} else if (cls.name === "Warlock") {
			// Warlock has unique spell slot progression (Pact Magic)
			const warlockSlots = [
				[1], // Level 1 - 1 slot, 1st level
				[2], // Level 2 - 2 slots, 1st level
				[0, 2], // Level 3 - 2 slots, 2nd level
				[0, 2], // Level 4 - 2 slots, 2nd level
				[0, 0, 2], // Level 5 - 2 slots, 3rd level
				[0, 0, 2], // Level 6 - 2 slots, 3rd level
				[0, 0, 0, 2], // Level 7 - 2 slots, 4th level
				[0, 0, 0, 2], // Level 8 - 2 slots, 4th level
				[0, 0, 0, 0, 2], // Level 9 - 2 slots, 5th level
				[0, 0, 0, 0, 2], // Level 10 - 2 slots, 5th level
				[0, 0, 0, 0, 3], // Level 11 - 3 slots, 5th level
				[0, 0, 0, 0, 3], // Level 12 - 3 slots, 5th level
				[0, 0, 0, 0, 3], // Level 13 - 3 slots, 5th level
				[0, 0, 0, 0, 3], // Level 14 - 3 slots, 5th level
				[0, 0, 0, 0, 3], // Level 15 - 3 slots, 5th level
				[0, 0, 0, 0, 3], // Level 16 - 3 slots, 5th level
				[0, 0, 0, 0, 4], // Level 17 - 4 slots, 5th level
				[0, 0, 0, 0, 4], // Level 18 - 4 slots, 5th level
				[0, 0, 0, 0, 4], // Level 19 - 4 slots, 5th level
				[0, 0, 0, 0, 4] // Level 20 - 4 slots, 5th level
			];

			if (level >= 1 && level <= 20) {
				const levelSlots = warlockSlots[level - 1];
				for (let i = 0; i < levelSlots.length; i++) {
					if (levelSlots[i] > 0) {
						slots[`${i + 1}`] = {max: levelSlots[i], used: 0};
					}
				}
			}
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
