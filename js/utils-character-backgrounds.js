/**
 * Background integration utilities for 5etools player character system.
 * Handles loading, parsing, and applying background data from official sources.
 */

"use strict";

// Background data management and application utilities
globalThis.CharacterBackgroundUtil = class {
	/**
	 * Loads all background data from the backgrounds.json file
	 * @returns {Promise<Array>} Array of background objects
	 */
	static async pLoadBackgrounds() {
		try {
			const backgroundData = await DataUtil.loadJSON("data/backgrounds.json");
			return backgroundData.background || [];
		} catch (error) {
			console.error("Failed to load background data:", error);
			return [];
		}
	}

	/**
	 * Applies a background to a character, adding skills, proficiencies, and equipment
	 * @param {Object} character - The character object to modify
	 * @param {string} backgroundName - Name of the background to apply
	 * @param {string} backgroundSource - Source of the background
	 * @returns {Promise<Object>} The modified character object
	 */
	static async pApplyBackgroundToCharacter(character, backgroundName, backgroundSource) {
		try {
			// Load background data if not already loaded
			const backgrounds = await this.pLoadBackgrounds();
			const background = backgrounds.find(bg =>
				bg.name === backgroundName && bg.source === backgroundSource
			);

			if (!background) {
				throw new Error(`Background "${backgroundName}" from "${backgroundSource}" not found`);
			}

			// Create a copy of the character to avoid mutations
			const updatedCharacter = MiscUtil.copyFast(character);

			// Set the background reference
			updatedCharacter.background = {
				name: backgroundName,
				source: backgroundSource
			};

			// Apply proficiencies using the same structure as class utility
			if (!updatedCharacter.proficiencies) {
				updatedCharacter.proficiencies = {};
			}

			// Apply skill proficiencies
			if (background.skillProficiencies) {
				updatedCharacter.proficiencies.skills = updatedCharacter.proficiencies.skills || [];

				background.skillProficiencies.forEach(skillProf => {
					// Handle different skill proficiency formats
					if (typeof skillProf === 'object') {
						Object.keys(skillProf).forEach(skill => {
							if (skillProf[skill] === true) {
								// Add skill if not already present
								if (!updatedCharacter.proficiencies.skills.some(sp =>
									typeof sp === 'object' && sp[skill] === true
								)) {
									updatedCharacter.proficiencies.skills.push({[skill]: true});
								}
							}
						});
					}
				});
			}

			// Apply language proficiencies
			if (background.languageProficiencies) {
				updatedCharacter.proficiencies.languages = updatedCharacter.proficiencies.languages || [];

				background.languageProficiencies.forEach(langProf => {
					// Add language proficiency if not already present
					const exists = updatedCharacter.proficiencies.languages.some(lp =>
						JSON.stringify(lp) === JSON.stringify(langProf)
					);
					if (!exists) {
						updatedCharacter.proficiencies.languages.push(langProf);
					}
				});
			}

			// Apply tool proficiencies
			if (background.toolProficiencies) {
				updatedCharacter.proficiencies.tools = updatedCharacter.proficiencies.tools || [];

				background.toolProficiencies.forEach(toolProf => {
					// Add tool proficiency if not already present
					const exists = updatedCharacter.proficiencies.tools.some(tp =>
						JSON.stringify(tp) === JSON.stringify(toolProf)
					);
					if (!exists) {
						updatedCharacter.proficiencies.tools.push(toolProf);
					}
				});
			}

			// Apply starting equipment
			if (background.startingEquipment) {
				// Initialize equipment structure if not present
				if (!updatedCharacter.startingEquipment) {
					updatedCharacter.startingEquipment = {
						default: [],
						goldAlternative: null,
						additionalFromBackground: false
					};
				}

				// Ensure the default array exists
				if (!Array.isArray(updatedCharacter.startingEquipment.default)) {
					updatedCharacter.startingEquipment.default = [];
				}

				// Add background equipment to the default equipment list
				background.startingEquipment.forEach(equipment => {
					// Add equipment if not already present
					const exists = updatedCharacter.startingEquipment.default.some(eq =>
						JSON.stringify(eq) === JSON.stringify(equipment)
					);
					if (!exists) {
						updatedCharacter.startingEquipment.default.push(equipment);
					}
				});

				// Mark that additional equipment comes from background
				updatedCharacter.startingEquipment.additionalFromBackground = true;
			}

			// Add background features as custom features
			if (background.entries) {
				updatedCharacter.customFeatures = updatedCharacter.customFeatures || [];

				background.entries.forEach(entry => {
					if (entry.name && entry.data && entry.data.isFeature) {
						// Add background feature as a custom feature
						const featureExists = updatedCharacter.customFeatures.some(cf =>
							cf.name === entry.name && cf.source === 'background'
						);

						if (!featureExists) {
							updatedCharacter.customFeatures.push({
								name: entry.name,
								description: this._getEntryText(entry),
								source: 'background',
								backgroundName: backgroundName
							});
						}
					}
				});
			}


			return updatedCharacter;

		} catch (error) {

			throw error;
		}
	}

	/**
	 * Gets a summary of skills provided by a background
	 * @param {Object} background - The background object
	 * @returns {string} Formatted skill summary
	 */
	static getSkillSummary(background) {
		if (!background.skillProficiencies || background.skillProficiencies.length === 0) {
			return "None";
		}

		const skills = [];
		background.skillProficiencies.forEach(skillProf => {
			if (typeof skillProf === 'object') {
				Object.keys(skillProf).forEach(skill => {
					if (skillProf[skill] === true) {
						skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
					}
				});
			}
		});

		return skills.length > 0 ? skills.join(", ") : "None";
	}

	/**
	 * Gets a summary of languages provided by a background
	 * @param {Object} background - The background object
	 * @returns {string} Formatted language summary
	 */
	static getLanguageSummary(background) {
		if (!background.languageProficiencies || background.languageProficiencies.length === 0) {
			return "None";
		}

		const languages = [];
		background.languageProficiencies.forEach(langProf => {
			if (langProf.anyStandard) {
				languages.push(`${langProf.anyStandard} of your choice`);
			} else if (typeof langProf === 'string') {
				languages.push(langProf);
			} else if (typeof langProf === 'object') {
				Object.keys(langProf).forEach(lang => {
					if (langProf[lang] === true) {
						languages.push(lang.charAt(0).toUpperCase() + lang.slice(1));
					}
				});
			}
		});

		return languages.length > 0 ? languages.join(", ") : "None";
	}

	/**
	 * Gets a summary of tools provided by a background
	 * @param {Object} background - The background object
	 * @returns {string} Formatted tool summary
	 */
	static getToolSummary(background) {
		if (!background.toolProficiencies || background.toolProficiencies.length === 0) {
			return "None";
		}

		const tools = [];
		background.toolProficiencies.forEach(toolProf => {
			if (typeof toolProf === 'string') {
				tools.push(toolProf);
			} else if (typeof toolProf === 'object') {
				Object.keys(toolProf).forEach(tool => {
					if (toolProf[tool] === true) {
						tools.push(tool);
					}
				});
			}
		});

		return tools.length > 0 ? tools.join(", ") : "None";
	}

	/**
	 * Extracts text content from an entry object
	 * @param {Object} entry - The entry object
	 * @returns {string} The text content
	 * @private
	 */
	static _getEntryText(entry) {
		if (typeof entry === 'string') {
			return entry;
		}

		if (entry.entries) {
			return entry.entries.map(e => this._getEntryText(e)).join(' ');
		}

		if (entry.entry) {
			return this._getEntryText(entry.entry);
		}

		return entry.name || '';
	}
};
