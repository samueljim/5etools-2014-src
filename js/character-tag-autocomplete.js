/**
 * Inline `{@tag}` autocomplete + modal "Insert link…" for character sheet text quick-edit.
 */
class CharacterTagAutocomplete {
	static _initPromise = null;
	static _TAG_TYPES = [
		{key: "item", label: "Item", search: () => SearchWidget.pGetUserItemSearch()},
		{key: "spell", label: "Spell", search: () => SearchWidget.pGetUserSpellSearch()},
		{key: "creature", label: "Creature", search: () => SearchWidget.pGetUserCreatureSearch()},
		{key: "feat", label: "Feat", search: () => SearchWidget.pGetUserFeatSearch()},
		{key: "race", label: "Race", search: () => SearchWidget.pGetUserRaceSearch()},
		{key: "background", label: "Background", search: () => SearchWidget.pGetUserBackgroundSearch()},
		{key: "optfeature", label: "Optional Feature", search: () => SearchWidget.pGetUserOptionalFeatureSearch()},
		{key: "condition", label: "Condition", indexCats: ["Condition"]},
		{key: "skill", label: "Skill", indexCats: ["Skill"]},
		{key: "class", label: "Class", indexCats: ["Class"]},

		// Free-text / roll tags (no entity search — prompt the user for the value)
		{key: "dice", label: "Dice Roll", freeText: true, hint: "e.g. 1d6+2"},
		{key: "damage", label: "Damage", freeText: true, hint: "e.g. 2d6+3"},
		{key: "hit", label: "To-Hit Bonus", freeText: true, hint: "e.g. 5"},
		{key: "dc", label: "Save DC", freeText: true, hint: "e.g. 15"},
		{key: "chance", label: "Chance", freeText: true, hint: "percent, e.g. 50"},
		{key: "recharge", label: "Recharge", freeText: true, hint: "e.g. 5"},
		{key: "b", label: "Bold", freeText: true, hint: "text to embolden"},
		{key: "i", label: "Italic", freeText: true, hint: "text to italicise"},
		{key: "u", label: "Underline", freeText: true, hint: "text to underline"},
		{key: "s", label: "Strikethrough", freeText: true, hint: "text to strike"},
		{key: "note", label: "Note", freeText: true, hint: "note text"},
	];

	static _INDEX_CAT_BY_TAG = {
		item: ["Item", "Items", "ItemsBasic", "ItemsMagic"],
		spell: ["Spell", "alt_Spell"],
		creature: ["Creature"],
		feat: ["Feat", "entity_Feats"],
		race: ["Race", "entity_Races"],
		background: ["Background", "entity_Backgrounds"],
		optfeature: ["OptionalFeature", "Optional Feature", "entity_OptionalFeatures"],
		condition: ["Condition"],
		skill: ["Skill"],
		class: ["Class"],
	};

	static async pEnsureInit () {
		if (!this._initPromise) {
			this._initPromise = (async () => {
				if (typeof SearchWidget?.pDoGlobalInit === "function") {
					await SearchWidget.pDoGlobalInit();
				}
			})().catch(err => {
				console.warn("CharacterTagAutocomplete: failed to init SearchWidget", err);
				this._initPromise = null;
			});
		}
		return this._initPromise;
	}

	/** Build a free-text tag (e.g. `{@dice 1d6+2}`) from a user-entered value. */
	static _buildFreeTextTag (typeEntry, input) {
		const val = (input || "").trim();
		if (!val) return null;
		if (typeof typeEntry.buildTag === "function") return typeEntry.buildTag(val);
		return `{@${typeEntry.key} ${val}}`;
	}

	/**
	 * Attach autocomplete + insert button UI around a textarea.
	 * @returns {{eleWrap: HTMLElement, destroy: Function, isBusy: Function}}
	 */
	static attach (textarea, {onInsert} = {}) {
		const nativeTa = textarea?.jquery ? textarea[0] : (textarea?.[0] || textarea);
		const ipt = e_({ele: nativeTa});
		const eleWrap = ee`<div class="character-tag-ac ve-flex-col ve-w-100"></div>`;
		const eleField = ee`<div class="character-tag-ac__field"></div>`;
		const eleToolbar = ee`<div class="character-tag-ac__toolbar ve-flex ve-flex-wrap gap-1 ve-mt-1"></div>`;
		const btnInsert = ee`<button type="button" class="ve-btn ve-btn-xxs ve-btn-default" title="Insert a renderer tag via search">Insert link…</button>`;
		eleToolbar.appends(btnInsert);
		const eleDropdown = ee`<div class="character-tag-ac__dropdown ve-hidden" role="listbox"></div>`;

		nativeTa.replaceWith(eleWrap);
		eleField.appends(nativeTa);
		eleField.appends(eleDropdown);
		eleWrap.appends(eleField);
		eleWrap.appends(eleToolbar);

		let activeIndex = -1;
		let currentMatches = [];
		let tagStart = -1;
		let tagEnd = -1;
		let isBusy = false;
		let savedSelection = {
			start: nativeTa.selectionStart ?? nativeTa.value.length,
			end: nativeTa.selectionEnd ?? nativeTa.selectionStart ?? nativeTa.value.length,
		};

		const rememberSelection = () => {
			savedSelection = {
				start: nativeTa.selectionStart ?? nativeTa.value.length,
				end: nativeTa.selectionEnd ?? nativeTa.selectionStart ?? nativeTa.value.length,
			};
		};

		const restoreFocus = (caret = null) => {
			try {
				nativeTa.focus();
				const start = caret?.start ?? savedSelection.start ?? nativeTa.value.length;
				const end = caret?.end ?? caret?.start ?? savedSelection.end ?? start;
				nativeTa.setSelectionRange(start, end);
			} catch (_) { /* ignore */ }
		};

		const hideDropdown = () => {
			eleDropdown.addClass("ve-hidden").empty();
			activeIndex = -1;
			currentMatches = [];
		};

		const insertAtCursor = (text) => {
			const start = savedSelection.start ?? nativeTa.selectionStart ?? nativeTa.value.length;
			const end = savedSelection.end ?? nativeTa.selectionEnd ?? start;
			const before = nativeTa.value.slice(0, start);
			const after = nativeTa.value.slice(end);
			nativeTa.value = `${before}${text}${after}`;
			const caret = start + text.length;
			savedSelection = {start: caret, end: caret};
			restoreFocus({start: caret, end: caret});
			onInsert?.(text);
		};

		const replaceTagRange = (tag, caretOffset = null) => {
			if (tagStart < 0) {
				insertAtCursor(tag);
				return;
			}
			const before = nativeTa.value.slice(0, tagStart);
			const after = nativeTa.value.slice(tagEnd);
			nativeTa.value = `${before}${tag}${after}`;
			const caret = caretOffset != null ? tagStart + caretOffset : tagStart + tag.length;
			savedSelection = {start: caret, end: caret};
			restoreFocus({start: caret, end: caret});
			hideDropdown();
			onInsert?.(tag);
		};

		const renderDropdown = () => {
			eleDropdown.empty();
			if (!currentMatches.length) {
				hideDropdown();
				return;
			}
			eleDropdown.removeClass("ve-hidden");
			currentMatches.forEach((m, i) => {
				const row = ee`<button type="button" class="character-tag-ac__row ve-btn ve-btn-default ve-btn-xs ve-w-100 ve-text-left ${i === activeIndex ? "active" : ""}" role="option">${m.label.qq()} <span class="ve-muted">${m.tagType}</span></button>`
					.onn("mousedown", (evt) => {
							evt.preventDefault();
							replaceTagRange(m.tag, m.caretOffset);
						});
				eleDropdown.appends(row);
			});
		};

		const docToTag = (doc, tagType) => {
			const name = doc.n || doc.name || "";
			const source = doc.s || doc.source || "";
			const defaultSrc = tagType === "spell" ? Parser.SRC_PHB
				: (tagType === "item" ? Parser.SRC_DMG : Parser.SRC_PHB);
			if (!source || source === defaultSrc) return `{@${tagType} ${name}}`;
			return `{@${tagType} ${name}|${source}}`;
		};

		const searchInline = async () => {
			await this.pEnsureInit();
			const value = nativeTa.value;
			const caret = nativeTa.selectionStart ?? value.length;
			const beforeCaret = value.slice(0, caret);
			// Trigger on a bare `@` (the leading `{` is added on insert) or an existing `{@`.
			const match = beforeCaret.match(/(\{?)@([a-zA-Z]*)(?:\s+([^|}]*))?$/);
			if (!match) {
				hideDropdown();
				return;
			}

			const matchStart = beforeCaret.length - match[0].length;
			const hasBrace = match[1] === "{";
			// For a bare `@`, require a word boundary before it so we don't fire on emails etc.
			if (!hasBrace) {
				const prevChar = matchStart > 0 ? beforeCaret[matchStart - 1] : "";
				if (prevChar && /[\w@]/.test(prevChar)) {
					hideDropdown();
					return;
				}
			}

			// `tagStart` points at the `{` or the bare `@`; replacing this range with a full
			// `{@…}` tag transparently supplies the missing `{` when the user typed only `@`.
			tagStart = matchStart;
			tagEnd = caret;
			const typedType = (match[2] || "").toLowerCase();
			const typedName = (match[3] || "").trim().toLowerCase();

			// Just `@` / `{@` with no type yet — offer the list of tag types to pick from.
			// Only while the caret sits right after the `@`, so we don't hijack prose like
			// "@ 5th level" or "look @ this".
			if (!typedType) {
				if (/\s/.test(match[0])) {
					hideDropdown();
					return;
				}
				currentMatches = this._TAG_TYPES.map(t => {
					const prefix = `{@${t.key} `;
					return {
						tagType: t.key,
						label: t.freeText ? `@${t.key} — ${t.label} (${t.hint})` : `@${t.key} — ${t.label}`,
						tag: t.freeText ? `${prefix}}` : prefix,
						caretOffset: t.freeText ? prefix.length : undefined,
					};
				}).slice(0, 12);
				activeIndex = currentMatches.length ? 0 : -1;
				renderDropdown();
				return;
			}

			const typeEntries = this._TAG_TYPES.filter(t => t.key.startsWith(typedType));

			const results = [];
			const indices = SearchWidget.CONTENT_INDICES || {};

			for (const typeEntry of typeEntries) {
				const catKeys = this._INDEX_CAT_BY_TAG[typeEntry.key] || [];
				for (const catKey of catKeys) {
					const index = indices[catKey];
					if (!index?.search) continue;
					const query = typedName || typedType || typeEntry.key;
					let hits = [];
					try {
						hits = index.search(query, {bool: "AND", expand: true}) || [];
					} catch (e) {
						continue;
					}
					for (const hit of hits.slice(0, 8)) {
						const doc = hit.doc || hit;
						const name = doc.n || doc.name;
						if (!name) continue;
						if (typedName && !String(name).toLowerCase().includes(typedName)) continue;
						results.push({
							tagType: typeEntry.key,
							label: `${name}${doc.s ? ` (${doc.s})` : ""}`,
							tag: docToTag(doc, typeEntry.key),
						});
						if (results.length >= 12) break;
					}
					if (results.length >= 12) break;
				}
				if (results.length >= 12) break;
			}

			// Free-text / roll tags (e.g. `{@dice 1d6}`) — wrap what the user has typed,
			// or offer a completion that drops the caret inside the tag.
			if (typedType) {
				for (const t of typeEntries.filter(t => t.freeText)) {
					if (typedName) {
						const tag = this._buildFreeTextTag(t, typedName);
						if (tag) results.unshift({tagType: t.key, label: tag, tag});
					} else {
						const prefix = `{@${t.key} `;
						results.unshift({tagType: t.key, label: `@${t.key} … (${t.hint})`, tag: `${prefix}}`, caretOffset: prefix.length});
					}
				}
			}

			// If only a tag type was typed (e.g. `{@item`), suggest completing the type
			if (!typedName && typedType && typedType !== typeEntries[0]?.key) {
				for (const t of typeEntries.filter(t => !t.freeText).slice(0, 6)) {
					results.unshift({
						tagType: t.key,
						label: `@${t.key} …`,
						tag: `{@${t.key} `,
					});
				}
			}

			currentMatches = results.slice(0, 12);
			activeIndex = currentMatches.length ? 0 : -1;
			renderDropdown();
		};

		const onInput = () => {
			rememberSelection();
			searchInline().catch(() => hideDropdown());
		};

		const onKeydown = (evt) => {
			rememberSelection();
			if (eleDropdown.hasClass("ve-hidden") || !currentMatches.length) {
				if (evt.key === "Escape") hideDropdown();
				return;
			}
			if (evt.key === "ArrowDown") {
				evt.preventDefault();
				activeIndex = (activeIndex + 1) % currentMatches.length;
				renderDropdown();
			} else if (evt.key === "ArrowUp") {
				evt.preventDefault();
				activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
				renderDropdown();
			} else if (evt.key === "Enter" || evt.key === "Tab") {
				if (activeIndex >= 0 && currentMatches[activeIndex]) {
					evt.preventDefault();
					replaceTagRange(currentMatches[activeIndex].tag, currentMatches[activeIndex].caretOffset);
				}
			} else if (evt.key === "Escape") {
				evt.preventDefault();
				hideDropdown();
			}
		};

		const onSelect = () => rememberSelection();

		btnInsert.onn("mousedown", (evt) => {
			// Keep textarea focused/editing while opening the modal
			evt.preventDefault();
			rememberSelection();
		});
		btnInsert.onn("click", async (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			rememberSelection();
			isBusy = true;
			try {
				await this.pEnsureInit();

				const typeChoice = await InputUiUtil.pGetUserEnum({
					title: "Insert Link",
					values: this._TAG_TYPES.map(t => t.label),
					fnDisplay: v => v,
					isResolveItem: true,
				});
				if (typeChoice == null) return;

				const typeEntry = this._TAG_TYPES.find(t => t.label === typeChoice);
				if (!typeEntry) return;

				let tag = null;
				if (typeEntry.freeText) {
					const hasSel = (savedSelection?.end ?? 0) > (savedSelection?.start ?? 0);
					const seed = hasSel ? nativeTa.value.slice(savedSelection.start, savedSelection.end) : "";
					const input = await InputUiUtil.pGetUserString({
						title: typeEntry.label,
						default: seed,
					});
					if (input == null) return;
					tag = this._buildFreeTextTag(typeEntry, input);
				} else if (typeof typeEntry.search === "function") {
					const result = await typeEntry.search();
					tag = result?.tag || null;
				} else {
					const catKeys = this._INDEX_CAT_BY_TAG[typeEntry.key] || [];
					const available = {};
					for (const k of catKeys) {
						if (SearchWidget.CONTENT_INDICES[k]) available[k] = SearchWidget.CONTENT_INDICES[k];
					}
					if (!Object.keys(available).length && SearchWidget.CONTENT_INDICES.ALL) {
						available.ALL = SearchWidget.CONTENT_INDICES.ALL;
					}
					if (!Object.keys(available).length) {
						JqueryUtil.doToast({content: `No search index available for ${typeEntry.label}.`, type: "warning"});
						return;
					}

					tag = await new Promise(resolve => {
						const searchWidget = new SearchWidget(
							available,
							(doc) => {
								doClose(false);
								resolve(docToTag(doc, typeEntry.key));
							},
							{defaultCategory: Object.keys(available)[0]},
						);
						const {eleModalInner, doClose} = UiUtil.getShowModal({
							title: `Select ${typeEntry.label}`,
							cbClose: (doResolve) => {
								searchWidget.getWrpSearch().detach();
								if (doResolve) resolve(null);
							},
						});
						eleModalInner.appends(searchWidget.getWrpSearch());
						searchWidget.doFocus();
					});
				}

				if (tag) insertAtCursor(tag);
				else restoreFocus();
			} finally {
				isBusy = false;
				// Modal close can race blur-finish; restore after UI settles
				setTimeout(() => restoreFocus(), 0);
			}
		});

		ipt.onn("input", onInput);
		ipt.onn("keydown", onKeydown);
		ipt.onn("keyup", onSelect);
		ipt.onn("click", onSelect);
		ipt.onn("select", onSelect);
		ipt.onn("blur", () => {
			// Delay so mousedown on dropdown can fire first
			setTimeout(() => hideDropdown(), 150);
		});

		this.pEnsureInit().catch(() => {});

		return {
			eleWrap,
			isBusy: () => isBusy,
			destroy: () => {
				ipt.off("input", onInput);
				ipt.off("keydown", onKeydown);
				ipt.off("keyup", onSelect);
				ipt.off("click", onSelect);
				ipt.off("select", onSelect);
				hideDropdown();
			},
		};
	}
}

globalThis.CharacterTagAutocomplete = CharacterTagAutocomplete;
