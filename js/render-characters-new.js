class RenderCharacters {
	static $getRenderedCharacter (character) {
		const $content = $(`<div></div>`);
		
		$content.append(this._getRenderedCharacterHeader(character));
		$content.append(this._getRenderedCharacterStats(character));
		$content.append(this._getRenderedCharacterFeatures(character));
		
		return $content;
	}

	static _getRenderedCharacterHeader (character) {
		const level = character.level || 1;
		const characterClass = character.class ? character.class.name : "Unknown";
		const race = character.race ? character.race.name : "Unknown";
		
		return `
			<div class="rd__b rd__b--1">
				<h1 class="rd__h rd__h--1" data-title-index="0">
					<span class="entry-title-inner">${character.name}</span>
				</h1>
				<p><i>Level ${level} ${race} ${characterClass}</i></p>
			</div>
		`;
	}

	static _getRenderedCharacterStats (character) {
		const ac = character.armorClass || 10;
		const hp = character.hitPoints || character.maxHitPoints || 1;
		const speed = character.speed || "30 ft.";
		
		const abilities = character.abilityScores || character.abilities || {
			strength: 10,
			dexterity: 10,
			constitution: 10,
			intelligence: 10,
			wisdom: 10,
			charisma: 10
		};

		return `
			<div class="rd__b rd__b--1">
				<div class="rd__b rd__b--2">
					<div class="statblock-monster">
						<div class="mon-stat-table">
							<div class="mon-stat-table__row">
								<div class="mon-stat-table__cell">
									<strong>Armor Class</strong> ${ac}
								</div>
								<div class="mon-stat-table__cell">
									<strong>Hit Points</strong> ${hp}
								</div>
								<div class="mon-stat-table__cell">
									<strong>Speed</strong> ${speed}
								</div>
							</div>
						</div>
						
						<div class="ability-scores">
							<div class="ability-score">
								<div class="ability-score__name">STR</div>
								<div class="ability-score__value">${abilities.strength || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.strength || 10)})</div>
							</div>
							<div class="ability-score">
								<div class="ability-score__name">DEX</div>
								<div class="ability-score__value">${abilities.dexterity || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.dexterity || 10)})</div>
							</div>
							<div class="ability-score">
								<div class="ability-score__name">CON</div>
								<div class="ability-score__value">${abilities.constitution || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.constitution || 10)})</div>
							</div>
							<div class="ability-score">
								<div class="ability-score__name">INT</div>
								<div class="ability-score__value">${abilities.intelligence || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.intelligence || 10)})</div>
							</div>
							<div class="ability-score">
								<div class="ability-score__name">WIS</div>
								<div class="ability-score__value">${abilities.wisdom || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.wisdom || 10)})</div>
							</div>
							<div class="ability-score">
								<div class="ability-score__name">CHA</div>
								<div class="ability-score__value">${abilities.charisma || 10}</div>
								<div class="ability-score__modifier">(${this._getModifier(abilities.charisma || 10)})</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	static _getRenderedCharacterFeatures (character) {
		let featuresHtml = "";
		
		// Add background
		if (character.background) {
			featuresHtml += `
				<div class="rd__b rd__b--2">
					<h3 class="rd__h rd__h--3">Background</h3>
					<p><strong>${character.background.name || character.background}</strong></p>
				</div>
			`;
		}

		// Add equipment
		if (character.equipment && character.equipment.length > 0) {
			featuresHtml += `
				<div class="rd__b rd__b--2">
					<h3 class="rd__h rd__h--3">Equipment</h3>
					<ul>
						${character.equipment.map(item => `<li>${item.name || item}</li>`).join("")}
					</ul>
				</div>
			`;
		}

		// Add skills
		if (character.skills && character.skills.length > 0) {
			featuresHtml += `
				<div class="rd__b rd__b--2">
					<h3 class="rd__h rd__h--3">Skills</h3>
					<p>${character.skills.join(", ")}</p>
				</div>
			`;
		}

		// Add spells if any
		if (character.spells && character.spells.length > 0) {
			featuresHtml += `
				<div class="rd__b rd__b--2">
					<h3 class="rd__h rd__h--3">Spells</h3>
					<ul>
						${character.spells.map(spell => `<li>${spell.name || spell}</li>`).join("")}
					</ul>
				</div>
			`;
		}

		return featuresHtml;
	}

	static _getModifier (score) {
		const modifier = Math.floor((score - 10) / 2);
		return modifier >= 0 ? `+${modifier}` : `${modifier}`;
	}
}
