"use strict";

/**
 * Scan a class/subclass feature's prose ("the new text" gained at a level) and extract
 * structured grants that should update the character sheet: skill/tool/language/armor/
 * weapon proficiencies, expertise, and limited-use resource counters.
 *
 * Class features do NOT carry structured grant keys in the 5etools data — the grants are
 * described in the feature `entries` text — so detection is text-based. Detectors are
 * intentionally conservative: unambiguous **fixed** grants (an explicit {@skill}/{@language}
 * /{@item tool} named in a "gain proficiency" clause) are returned as auto-appliable; any
 * "of your choice" / "from the following list" grant is returned as a **choice** for the UI
 * to resolve via a chooser modal, so nothing wrong is applied silently.
 *
 * Attached to globalThis for classic (non-module) script loading, matching the other
 * character-builder helpers (e.g. subclass-options.js, spell-filter-context.js).
 */
(function (global) {
	const NUM_WORD = {a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5};

	const ALL_SKILLS = [
		"acrobatics", "animal handling", "arcana", "athletics", "deception", "history",
		"insight", "intimidation", "investigation", "medicine", "nature", "perception",
		"performance", "persuasion", "religion", "sleight of hand", "stealth", "survival",
	];

	/** Recursively flatten a feature's `entries` (and nested entry/items) into plain text, tags preserved. */
	function flattenEntries (e) {
		if (e == null) return "";
		if (typeof e === "string") return e;
		if (Array.isArray(e)) return e.map(flattenEntries).join(" ");
		if (typeof e === "object") {
			let s = "";
			if (e.entry) s += ` ${flattenEntries(e.entry)}`;
			if (e.entries) s += ` ${flattenEntries(e.entries)}`;
			if (e.items) s += ` ${flattenEntries(e.items)}`;
			return s;
		}
		return "";
	}

	const wordToNum = (w) => NUM_WORD[String(w || "").toLowerCase()] ?? (parseInt(w, 10) || 1);
	const normSkillKey = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "_");

	/** Extract the display names from all `{@tag NAME|source}` occurrences of a given tag. */
	function extractTags (text, tag) {
		const re = new RegExp(`\\{@${tag}\\s+([^|}]+)(?:\\|[^}]*)?\\}`, "gi");
		const out = [];
		let m;
		while ((m = re.exec(text))) out.push(m[1].trim());
		return out;
	}

	/**
	 * @param feature A loaded class/subclass feature object (`{name, entries, ...}`).
	 * @returns Grants bag. Fixed arrays are safe to auto-apply; `*Choices` require a chooser.
	 */
	function scanFeatureGrants (feature) {
		const grants = {
			skills: [], // fixed skill keys (underscored)
			skillChoices: [], // [{count, from:[skill display names]}]
			expertise: [], // [{count}]
			languages: [], // fixed language names
			languageChoices: [], // [{count}]
			tools: [], // fixed tool names
			toolChoices: [], // [{count}]
			armor: [], // fixed armor prof (e.g. "heavy armor")
			weapons: [], // fixed weapon prof (e.g. "martial weapons")
			resources: [], // [{name, max, per}] limited-use counters
		};
		if (!feature) return grants;

		const name = String(feature.name || "").trim();
		const text = flattenEntries(feature.entries).replace(/\s+/g, " ").trim();
		if (!text && !name) return grants;
		const lower = text.toLowerCase();
		const hasChoice = /of your choice|from the following|from the list/i.test(text);

		// ----- Expertise (Rogue/Bard) -----
		if (/^expertise$/i.test(name) || /\bgain (?:the benefit of )?expertise\b/i.test(lower)) {
			const m = lower.match(/choose (?:another )?(\w+)/);
			grants.expertise.push({count: m ? wordToNum(m[1]) : 2});
		}

		// ----- Skill proficiencies -----
		let m;
		if ((m = text.match(/proficienc\w* (?:in|with) (\w+) skills?(?: of your choice| from the following| from the list)/i))) {
			const after = text.slice(m.index);
			const listed = extractTags(after, "skill").map(s => s.toLowerCase());
			grants.skillChoices.push({count: wordToNum(m[1]), from: listed.length ? listed : ALL_SKILLS.slice()});
		} else if ((m = text.match(/proficien\w*(?: in)? your choice of (\w+) (?:of the following )?skills?/i))) {
			// e.g. "proficient in your choice of two of the following skills: {@skill ...}"
			const after = text.slice(m.index);
			const listed = extractTags(after, "skill").map(s => s.toLowerCase());
			grants.skillChoices.push({count: wordToNum(m[1]), from: listed.length ? listed : ALL_SKILLS.slice()});
		} else if (/one of the following skills of your choice/i.test(text)) {
			const after = text.slice(text.toLowerCase().indexOf("following skills"));
			const listed = extractTags(after, "skill").map(s => s.toLowerCase());
			grants.skillChoices.push({count: 1, from: listed.length ? listed : ALL_SKILLS.slice()});
		} else if (/one skill of your choice/i.test(text)) {
			grants.skillChoices.push({count: 1, from: ALL_SKILLS.slice()});
		}
		// Fixed skill grant: explicit {@skill} named in a "gain proficiency" clause, no choice.
		if (!hasChoice && /gain(?:s)? proficiency in/i.test(lower)) {
			extractTags(text, "skill").forEach(s => grants.skills.push(normSkillKey(s)));
		}

		// ----- Languages -----
		if ((m = lower.match(/learn(?:[^.]*?)\b(a|an|one|two|three|\d+) (?:other )?languages? of your choice/))) {
			grants.languageChoices.push({count: wordToNum(m[1])});
		} else if (/(?:one|a) (?:other )?language of your choice/i.test(lower)) {
			grants.languageChoices.push({count: 1});
		}
		extractTags(text, "language").forEach(l => grants.languages.push(l));

		// ----- Tools -----
		const toolTags = extractTags(text, "item").filter(t => /tools|supplies|kit|instruments?|utensils/i.test(t));
		if (!hasChoice && /gain(?:s)? proficiency with/i.test(lower)) {
			toolTags.forEach(t => grants.tools.push(t));
		}
		if (/(?:artisan's tools|type of .*? tools|tool|gaming set|musical instrument) of your choice/i.test(lower)) {
			const cm = lower.match(/(\w+) (?:tools?|gaming sets?|musical instruments?) of your choice/);
			grants.toolChoices.push({count: cm ? wordToNum(cm[1]) : 1});
		}

		// ----- Fixed armor / weapon training -----
		if (/gain(?:s)? proficiency with[^.]*heavy armor/i.test(lower)) grants.armor.push("heavy armor");
		if (/gain(?:s)? proficiency with[^.]*medium armor/i.test(lower)) grants.armor.push("medium armor");
		if (/gain(?:s)? proficiency with[^.]*light armor/i.test(lower)) grants.armor.push("light armor");
		if (/gain(?:s)? proficiency with[^.]*shield/i.test(lower)) grants.armor.push("shields");
		if (/gain(?:s)? proficiency with[^.]*martial weapons/i.test(lower)) grants.weapons.push("martial weapons");

		// ----- Limited-use resource counters (conservative) -----
		// e.g. "a number of times equal to your proficiency bonus ... finish a long rest"
		const perRest = /finish a (short or long|long|short) rest/i.exec(lower);
		if (perRest && name) {
			let max = null;
			if (/number of times equal to your proficiency bonus/i.test(lower)) max = "PB";
			else if ((m = lower.match(/\b(once|twice|(\w+) times)\b[^.]{0,40}(?:per|each|before you must finish|until you finish)/))) {
				if (/once/.test(m[0])) max = 1;
				else if (/twice/.test(m[0])) max = 2;
				else if (m[2]) max = wordToNum(m[2]);
			}
			if (max != null) {
				const per = /short or long/i.test(perRest[1]) ? "short/long rest" : `${perRest[1].toLowerCase()} rest`;
				grants.resources.push({name, max, per});
			}
		}

		return grants;
	}

	/** True when a grants bag contains nothing actionable. */
	function isEmptyGrants (g) {
		return !g || !(
			g.skills.length || g.skillChoices.length || g.expertise.length
			|| g.languages.length || g.languageChoices.length
			|| g.tools.length || g.toolChoices.length
			|| g.armor.length || g.weapons.length || g.resources.length
		);
	}

	global.CharacterBuilderFeatureGrants = {
		scanFeatureGrants,
		isEmptyGrants,
		flattenEntries,
		ALL_SKILLS,
		_normSkillKey: normSkillKey,
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
