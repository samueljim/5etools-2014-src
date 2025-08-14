import "../../js/parser.js";
import "../../js/utils.js";
import "../../js/utils-characters.js";

describe("CharacterUtil", () => {
	describe("getDefaultCharacterData", () => {
		it("should return valid default character data", () => {
			const defaultChar = CharacterUtil.getDefaultCharacterData();

			expect(defaultChar).toBeDefined();
			expect(defaultChar.name).toBe("");
			expect(defaultChar.source).toBe("HOMEBREW");
			expect(defaultChar.level).toBe(1);
			expect(defaultChar.abilityScores).toBeDefined();
			expect(defaultChar.abilityScores.str).toBe(10);
			expect(defaultChar.hitPoints).toBeDefined();
			expect(defaultChar.spellcasting).toBeDefined();
			expect(defaultChar._meta).toBeDefined();
		});

		it("should have all required ability scores", () => {
			const defaultChar = CharacterUtil.getDefaultCharacterData();
			const abilities = ["str", "dex", "con", "int", "wis", "cha"];

			abilities.forEach(ability => {
				expect(defaultChar.abilityScores[ability]).toBe(10);
			});
		});

		it("should have all spell slot levels", () => {
			const defaultChar = CharacterUtil.getDefaultCharacterData();

			for (let level = 1; level <= 9; level++) {
				expect(defaultChar.spellcasting.slots[level.toString()]).toBeDefined();
				expect(defaultChar.spellcasting.slots[level.toString()].max).toBe(0);
				expect(defaultChar.spellcasting.slots[level.toString()].used).toBe(0);
			}
		});
	});

	describe("validateCharacter", () => {
		it("should validate a valid character", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should reject character without name", () => {
			const character = CharacterUtil.getDefaultCharacterData();
			character.name = "";

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Character name is required");
		});

		it("should reject character with invalid level", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
				level: 0,
			});

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Character level must be an integer between 1 and 20");
		});

		it("should reject character with invalid ability scores", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});
			character.abilityScores.str = 0;

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("STR score must be an integer between 1 and 30");
		});

		it("should reject character with negative hit points", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});
			character.hitPoints.max = -1;

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Maximum hit points must be a non-negative integer");
		});

		it("should reject character with invalid spell slots", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});
			character.spellcasting.slots["1"].used = 5;
			character.spellcasting.slots["1"].max = 2;

			const result = CharacterUtil.validateCharacter(character);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Spell slot level 1 used cannot exceed max");
		});

		it("should reject null character", () => {
			const result = CharacterUtil.validateCharacter(null);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Character data is required");
		});
	});

	describe("createNewCharacter", () => {
		it("should create character with unique ID and timestamps", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			expect(character._meta.uniqueId).toBeDefined();
			expect(character._meta.created).toBeDefined();
			expect(character._meta.lastModified).toBeDefined();
			expect(character.name).toBe("Test Character");
		});

		it("should apply overrides correctly", () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
				level: 5,
				abilityScores: {
					str: 15,
					dex: 14,
					con: 13,
					int: 12,
					wis: 10,
					cha: 8,
				}
			});

			expect(character.name).toBe("Test Character");
			expect(character.level).toBe(5);
			expect(character.abilityScores.str).toBe(15);
			expect(character.abilityScores.dex).toBe(14);
		});
	});

	describe("getAbilityModifier", () => {
		it("should calculate ability modifiers correctly", () => {
			expect(CharacterUtil.getAbilityModifier(10)).toBe(0);
			expect(CharacterUtil.getAbilityModifier(11)).toBe(0);
			expect(CharacterUtil.getAbilityModifier(12)).toBe(1);
			expect(CharacterUtil.getAbilityModifier(8)).toBe(-1);
			expect(CharacterUtil.getAbilityModifier(20)).toBe(5);
			expect(CharacterUtil.getAbilityModifier(1)).toBe(-5);
		});
	});

	describe("getProficiencyBonus", () => {
		it("should calculate proficiency bonus correctly", () => {
			expect(CharacterUtil.getProficiencyBonus(1)).toBe(2);
			expect(CharacterUtil.getProficiencyBonus(4)).toBe(2);
			expect(CharacterUtil.getProficiencyBonus(5)).toBe(3);
			expect(CharacterUtil.getProficiencyBonus(8)).toBe(3);
			expect(CharacterUtil.getProficiencyBonus(9)).toBe(4);
			expect(CharacterUtil.getProficiencyBonus(12)).toBe(4);
			expect(CharacterUtil.getProficiencyBonus(13)).toBe(5);
			expect(CharacterUtil.getProficiencyBonus(16)).toBe(5);
			expect(CharacterUtil.getProficiencyBonus(17)).toBe(6);
			expect(CharacterUtil.getProficiencyBonus(20)).toBe(6);
		});
	});

	describe("updateLastModified", () => {
		it("should update last modified timestamp", (done) => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const originalTimestamp = character._meta.lastModified;

			// Wait a bit to ensure timestamp difference
			setTimeout(() => {
				const updatedCharacter = CharacterUtil.updateLastModified(character);
				expect(updatedCharacter._meta.lastModified).not.toBe(originalTimestamp);
				done();
			}, 10);
		});

		it("should create _meta if missing", () => {
			const character = {name: "Test Character"};
			const updatedCharacter = CharacterUtil.updateLastModified(character);

			expect(updatedCharacter._meta).toBeDefined();
			expect(updatedCharacter._meta.lastModified).toBeDefined();
		});
	});
});

describe("CharacterStorageUtil", () => {
	// Mock StorageUtil for testing
	let mockStorage = {};

	beforeEach(() => {
		// Reset mock storage before each test
		mockStorage = {};

		// Mock StorageUtil methods using simple function replacement
		StorageUtil.pGet = async (key) => {
			return mockStorage[key] || null;
		};

		StorageUtil.pSet = async (key, value) => {
			mockStorage[key] = value;
		};

		// Clear cache
		CharacterStorageUtil.clearCache();
	});

	describe("pLoadCharacters", () => {
		it("should return empty array when no characters stored", async () => {
			const characters = await CharacterStorageUtil.pLoadCharacters();
			expect(characters).toEqual([]);
		});

		it("should return cached characters on subsequent calls", async () => {
			const character = CharacterUtil.createNewCharacter({name: "Test Character"});
			await CharacterStorageUtil.pAddCharacter(character);

			const characters1 = await CharacterStorageUtil.pLoadCharacters();
			const characters2 = await CharacterStorageUtil.pLoadCharacters();

			expect(characters1).toBe(characters2); // Should be same reference (cached)
		});
	});

	describe("pAddCharacter", () => {
		it("should add a valid character", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			expect(addedCharacter._meta.uniqueId).toBeDefined();

			const characters = await CharacterStorageUtil.pLoadCharacters();
			expect(characters).toHaveLength(1);
			expect(characters[0].name).toBe("Test Character");
		});

		it("should reject invalid character", async () => {
			const invalidCharacter = {
				name: "", // Invalid: empty name
				level: 1,
			};

			await expect(CharacterStorageUtil.pAddCharacter(invalidCharacter))
				.rejects.toThrow("Character validation failed");
		});

		it("should generate unique ID if missing", async () => {
			const character = {
				name: "Test Character",
				level: 1,
				abilityScores: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10},
				hitPoints: {max: 10, current: 10, temp: 0},
			};

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			expect(addedCharacter._meta.uniqueId).toBeDefined();
		});
	});

	describe("pUpdateCharacter", () => {
		it("should update existing character", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			addedCharacter.name = "Updated Character";

			const updatedCharacter = await CharacterStorageUtil.pUpdateCharacter(addedCharacter);
			expect(updatedCharacter.name).toBe("Updated Character");

			const characters = await CharacterStorageUtil.pLoadCharacters();
			expect(characters[0].name).toBe("Updated Character");
		});

		it("should reject character without unique ID", async () => {
			const character = {
				name: "Test Character",
				level: 1,
			};

			await expect(CharacterStorageUtil.pUpdateCharacter(character))
				.rejects.toThrow("Character must have a unique ID to update");
		});

		it("should reject character not found", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});
			character._meta.uniqueId = "non-existent-id";

			await expect(CharacterStorageUtil.pUpdateCharacter(character))
				.rejects.toThrow("Character not found");
		});
	});

	describe("pRemoveCharacter", () => {
		it("should remove existing character", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			const removed = await CharacterStorageUtil.pRemoveCharacter(addedCharacter._meta.uniqueId);

			expect(removed).toBe(true);

			const characters = await CharacterStorageUtil.pLoadCharacters();
			expect(characters).toHaveLength(0);
		});

		it("should return false for non-existent character", async () => {
			const removed = await CharacterStorageUtil.pRemoveCharacter("non-existent-id");
			expect(removed).toBe(false);
		});
	});

	describe("pGetCharacter", () => {
		it("should retrieve existing character", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			const retrievedCharacter = await CharacterStorageUtil.pGetCharacter(addedCharacter._meta.uniqueId);

			expect(retrievedCharacter).toBeDefined();
			expect(retrievedCharacter.name).toBe("Test Character");
		});

		it("should return null for non-existent character", async () => {
			const character = await CharacterStorageUtil.pGetCharacter("non-existent-id");
			expect(character).toBeNull();
		});
	});

	describe("pExportCharacter", () => {
		it("should export character as JSON", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const addedCharacter = await CharacterStorageUtil.pAddCharacter(character);
			const exported = await CharacterStorageUtil.pExportCharacter(addedCharacter._meta.uniqueId);

			expect(typeof exported).toBe("string");
			const parsed = JSON.parse(exported);
			expect(parsed.name).toBe("Test Character");
		});

		it("should reject non-existent character", async () => {
			await expect(CharacterStorageUtil.pExportCharacter("non-existent-id"))
				.rejects.toThrow("Character not found");
		});
	});

	describe("pImportCharacter", () => {
		it("should import valid character JSON", async () => {
			const character = CharacterUtil.createNewCharacter({
				name: "Test Character",
			});

			const jsonData = JSON.stringify(character);
			const importedCharacter = await CharacterStorageUtil.pImportCharacter(jsonData);

			expect(importedCharacter.name).toBe("Test Character");
			expect(importedCharacter._meta.uniqueId).not.toBe(character._meta.uniqueId); // Should have new ID
		});

		it("should reject invalid JSON", async () => {
			await expect(CharacterStorageUtil.pImportCharacter("invalid json"))
				.rejects.toThrow("Invalid JSON format");
		});

		it("should reject invalid character data", async () => {
			const invalidData = JSON.stringify({name: ""}); // Invalid: empty name

			await expect(CharacterStorageUtil.pImportCharacter(invalidData))
				.rejects.toThrow("Imported character validation failed");
		});
	});

	describe("pGetStorageStats", () => {
		it("should return storage statistics", async () => {
			const character1 = CharacterUtil.createNewCharacter({name: "Character 1"});
			const character2 = CharacterUtil.createNewCharacter({name: "Character 2"});

			await CharacterStorageUtil.pAddCharacter(character1);
			await CharacterStorageUtil.pAddCharacter(character2);

			const stats = await CharacterStorageUtil.pGetStorageStats();

			expect(stats.totalCharacters).toBe(2);
			expect(stats.storageKey).toBe(CharacterUtil.STORAGE_KEY);
			expect(stats.lastAccessed).toBeDefined();
		});
	});
});
