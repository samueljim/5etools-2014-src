/**
 * Race integration utilities for 5etools player character system.
 * Handles loading, parsing, and applying race data from official sources.
 */

"use strict";

// Race data management and application utilities
globalThis.CharacterRaceUtil = class {
	static _raceData = null;
	static _subraceData = null;
	static _isLoaded = false;

	/**
	 * Loads race and subrace data from official sources
	 * @returns {Promise<void>}
	 */
	static async pLoadRaceData () {
		if (this._isLoaded) return;

		try {
			// Load raw race data to get both races and subraces separately
			const rawRaceData = await DataUtil.loadJSON("data/races.json");
			this._raceData = rawRaceData.race || [];
			this._subraceData = rawRaceData.subrace || [];
			this._isLoaded = true;
		} catch (error) {
			console.error("Failed to load race data:", error);
			this._raceData = [];
			this._subraceData = [];
			this._isLoaded = true;
		}
	}

	/**
	 * Gets all available races, optionally filtered
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} Array of race objects
	 */
	static async pGetRaces (options = {}) {
		await this.pLoadRaceData();

		let races = [...this._raceData];

		// Filter by source if specified
		if (options.sources && options.sources.length > 0) {
			races = races.filter(race => options.sources.includes(race.source));
		}

		// Filter by search term if specified
		if (options.search) {
			const searchTerm = options.search.toLowerCase();
			races = races.filter(race =>
				race.name.toLowerCase().includes(searchTerm)
			);
		}

		// Sort by name
		races.sort((a, b) => a.name.localeCompare(b.name));

		return races;
	}

	/**
	 * Gets subraces for a specific race
	 * @param {string} raceName - Name of the race
	 * @param {string} raceSource - Source of the race
	 * @returns {Promise<Array>} Array of subrace objects
	 */
	static async pGetSubraces (raceName, raceSource) {
		await this.pLoadRaceData();

		const subraces = this._subraceData.filter(subrace =>
			subrace.raceName === raceName && subrace.raceSource === raceSource
		);

		// Sort by name
		subraces.sort((a, b) => a.name.localeCompare(b.name));

		return subraces;
	}

	/**
	 * Gets a specific race by name and source
	 * @param {string} name - Race name
	 * @param {string} source - Race source
	 * @returns {Promise<Object|null>} Race object or null if not found
	 */
	static async pGetRace (name, source) {
		await this.pLoadRaceData();
		return this._raceData.find(race => race.name === name && race.source === source) || null;
	}

	/**
	 * Gets a specific subrace by name, race name, and sources
	 * @param {string} name - Subrace name
	 * @param {string} raceName - Race name
	 * @param {string} raceSource - Race source
	 * @returns {Promise<Object|null>} Subrace object or null if not found
	 */
	static async pGetSubrace (name, raceName, raceSource) {
		await this.pLoadRaceData();
		return this._subraceData.find(subrace =>
			subrace.name === name &&
			subrace.raceName === raceName &&
			subrace.raceSource === raceSource
		) || null;
	}

	/**
	 * Applies race features to a character
	 * @param {Object} character - Character to modify
	 * @param {string} raceName - Race name
	 * @param {string} raceSource - Race source
	 * @param {string} subraceName - Optional subrace name
	 * @returns {Promise<Object>} Modified character
	 */
	static async pApplyRaceToCharacter (character, raceName, raceSource, subraceName = null) {
		const race = await this.pGetRace(raceName, raceSource);
		if (!race) {
			throw new Error(`Race ${raceName} from ${raceSource} not found`);
		}

		// Clone character to avoid mutation
		const modifiedCharacter = CharacterUtil.cloneCharacter(character);

		// Set race information
		modifiedCharacter.race = {
			name: raceName,
			source: raceSource,
			subrace: subraceName
		};

		// Apply racial ability score improvements
		this._applyAbilityScoreImprovements(modifiedCharacter, race);

		// Apply racial traits and features
		this._applyRacialTraits(modifiedCharacter, race);

		// Apply language proficiencies
		this._applyLanguageProficiencies(modifiedCharacter, race);

		// Apply skill proficiencies
		this._applySkillProficiencies(modifiedCharacter, race);

		// Apply other proficiencies (armor, weapons, tools)
		this._applyOtherProficiencies(modifiedCharacter, race);

		// Apply speed and size
		this._applyPhysicalTraits(modifiedCharacter, race);

		// Apply subrace features if specified
		if (subraceName) {
			const subrace = await this.pGetSubrace(subraceName, raceName, raceSource);
			if (subrace) {
				this._applySubraceFeatures(modifiedCharacter, subrace);
			}
		}

		return modifiedCharacter;
	}

	/**
	 * Applies racial ability score improvements
	 * @private
	 */
	static _applyAbilityScoreImprovements (character, race) {
		if (!race.ability || !Array.isArray(race.ability)) return;

		// Initialize racial ASI tracking if not present
		if (!character._racialASI) {
			character._racialASI = {
				str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
			};
		}

		// Apply each ability score improvement
		race.ability.forEach(asiGroup => {
			Object.keys(asiGroup).forEach(ability => {
				if (character.abilityScores[ability] !== undefined) {
					const improvement = asiGroup[ability];
					character.abilityScores[ability] += improvement;
					character._racialASI[ability] += improvement;
				}
			});
		});
	}

	/**
	 * Applies racial traits and features
	 * @private
	 */
	static _applyRacialTraits (character, race) {
		if (!race.entries || !Array.isArray(race.entries)) return;

		// Initialize racial features array if not present
		if (!character._racialFeatures) {
			character._racialFeatures = [];
		}

		// Extract and store racial features
		race.entries.forEach(entry => {
			if (entry.type === "entries" && entry.name) {
				character._racialFeatures.push({
					name: entry.name,
					description: entry.entries ? entry.entries.join(" ") : "",
					source: "racial",
					raceSource: race.source
				});
			}
		});
	}

	/**
	 * Applies language proficiencies
	 * @private
	 */
	static _applyLanguageProficiencies (character, race) {
		if (!race.languageProficiencies || !Array.isArray(race.languageProficiencies)) return;

		// Initialize language proficiencies if not present
		if (!character._languageProficiencies) {
			character._languageProficiencies = [];
		}

		race.languageProficiencies.forEach(langGroup => {
			Object.keys(langGroup).forEach(lang => {
				if (langGroup[lang] === true) {
					// Specific language
					if (lang !== "other" && lang !== "anyStandard") {
						character._languageProficiencies.push({
							language: lang,
							source: "racial"
						});
					}
				}
			});

			// Handle "choose any" languages
			if (langGroup.other || langGroup.anyStandard) {
				character._languageProficiencies.push({
					language: "choice",
					count: langGroup.other || langGroup.anyStandard,
					source: "racial"
				});
			}
		});
	}

	/**
	 * Applies skill proficiencies
	 * @private
	 */
	static _applySkillProficiencies (character, race) {
		if (!race.skillProficiencies || !Array.isArray(race.skillProficiencies)) return;

		// Initialize skill proficiencies if not present
		if (!character._skillProficiencies) {
			character._skillProficiencies = [];
		}

		race.skillProficiencies.forEach(skillGroup => {
			Object.keys(skillGroup).forEach(skill => {
				if (skillGroup[skill] === true) {
					character._skillProficiencies.push({
						skill: skill,
						source: "racial"
					});
				}
			});

			// Handle skill choices
			if (skillGroup.choose) {
				character._skillProficiencies.push({
					skill: "choice",
					choices: skillGroup.choose.from || [],
					count: skillGroup.choose.count || 1,
					source: "racial"
				});
			}
		});
	}

	/**
	 * Applies other proficiencies (armor, weapons, tools)
	 * @private
	 */
	static _applyOtherProficiencies (character, race) {
		// Initialize proficiency arrays if not present
		if (!character._armorProficiencies) character._armorProficiencies = [];
		if (!character._weaponProficiencies) character._weaponProficiencies = [];
		if (!character._toolProficiencies) character._toolProficiencies = [];

		// Apply armor proficiencies
		if (race.armorProficiencies) {
			race.armorProficiencies.forEach(armorGroup => {
				Object.keys(armorGroup).forEach(armor => {
					if (armorGroup[armor] === true) {
						character._armorProficiencies.push({
							armor: armor,
							source: "racial"
						});
					}
				});
			});
		}

		// Apply weapon proficiencies
		if (race.weaponProficiencies) {
			race.weaponProficiencies.forEach(weaponGroup => {
				Object.keys(weaponGroup).forEach(weapon => {
					if (weaponGroup[weapon] === true) {
						character._weaponProficiencies.push({
							weapon: weapon,
							source: "racial"
						});
					}
				});
			});
		}

		// Apply tool proficiencies
		if (race.toolProficiencies) {
			race.toolProficiencies.forEach(toolGroup => {
				Object.keys(toolGroup).forEach(tool => {
					if (toolGroup[tool] === true) {
						character._toolProficiencies.push({
							tool: tool,
							source: "racial"
						});
					}
				});
			});
		}
	}

	/**
	 * Applies physical traits (speed, size)
	 * @private
	 */
	static _applyPhysicalTraits (character, race) {
		// Initialize physical traits if not present
		if (!character._physicalTraits) {
			character._physicalTraits = {};
		}

		// Apply speed
		if (race.speed) {
			character._physicalTraits.speed = race.speed;
		}

		// Apply size
		if (race.size && Array.isArray(race.size)) {
			character._physicalTraits.size = race.size[0]; // Take first size if multiple
		}
	}

	/**
	 * Applies subrace features
	 * @private
	 */
	static _applySubraceFeatures (character, subrace) {
		// Apply subrace ability score improvements
		this._applyAbilityScoreImprovements(character, subrace);

		// Apply subrace traits
		this._applyRacialTraits(character, subrace);

		// Apply subrace proficiencies
		this._applyLanguageProficiencies(character, subrace);
		this._applySkillProficiencies(character, subrace);
		this._applyOtherProficiencies(character, subrace);
	}

	/**
	 * Gets formatted race options for dropdowns
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} Array of formatted race options
	 */
	static async pGetRaceOptions (options = {}) {
		const races = await this.pGetRaces(options);

		return races.map(race => ({
			value: `${race.name}|${race.source}`,
			text: `${race.name} (${race.source})`,
			name: race.name,
			source: race.source,
			hasSubraces: this._hasSubraces(race.name, race.source)
		}));
	}

	/**
	 * Gets formatted subrace options for dropdowns
	 * @param {string} raceName - Race name
	 * @param {string} raceSource - Race source
	 * @returns {Promise<Array>} Array of formatted subrace options
	 */
	static async pGetSubraceOptions (raceName, raceSource) {
		const subraces = await this.pGetSubraces(raceName, raceSource);

		return subraces.map(subrace => ({
			value: subrace.name,
			text: subrace.name,
			name: subrace.name
		}));
	}

	/**
	 * Checks if a race has subraces
	 * @private
	 */
	static _hasSubraces (raceName, raceSource) {
		if (!this._subraceData) return false;
		return this._subraceData.some(subrace =>
			subrace.raceName === raceName && subrace.raceSource === raceSource
		);
	}

	/**
	 * Gets race summary for display
	 * @param {string} raceName - Race name
	 * @param {string} raceSource - Race source
	 * @param {string} subraceName - Optional subrace name
	 * @returns {Promise<Object>} Race summary object
	 */
	static async pGetRaceSummary (raceName, raceSource, subraceName = null) {
		const race = await this.pGetRace(raceName, raceSource);
		if (!race) return null;

		const summary = {
			name: race.name,
			source: race.source,
			size: race.size ? race.size[0] : "Medium",
			speed: race.speed || {walk: 30},
			abilityScoreImprovements: race.ability || [],
			traits: [],
			languages: [],
			proficiencies: {
				skills: [],
				armor: [],
				weapons: [],
				tools: []
			}
		};

		// Extract traits
		if (race.entries) {
			race.entries.forEach(entry => {
				if (entry.type === "entries" && entry.name) {
					summary.traits.push({
						name: entry.name,
						description: entry.entries ? entry.entries.join(" ") : ""
					});
				}
			});
		}

		// Extract languages
		if (race.languageProficiencies) {
			race.languageProficiencies.forEach(langGroup => {
				Object.keys(langGroup).forEach(lang => {
					if (langGroup[lang] === true && lang !== "other" && lang !== "anyStandard") {
						summary.languages.push(lang);
					}
				});
			});
		}

		// Add subrace information if specified
		if (subraceName) {
			const subrace = await this.pGetSubrace(subraceName, raceName, raceSource);
			if (subrace) {
				summary.subrace = {
					name: subrace.name,
					abilityScoreImprovements: subrace.ability || [],
					traits: []
				};

				if (subrace.entries) {
					subrace.entries.forEach(entry => {
						if (entry.type === "entries" && entry.name) {
							summary.subrace.traits.push({
								name: entry.name,
								description: entry.entries ? entry.entries.join(" ") : ""
							});
						}
					});
				}
			}
		}

		return summary;
	}
};
