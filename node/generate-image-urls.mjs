#!/usr/bin/env node

/**
 * Generate External Image URLs for Service Worker Caching
 *
 * This script scans through all JSON data files to find image references
 * and generates a list of external image URLs that should be cached by the service worker.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Base URL for images. Relative, because images are proxied through our own origin (see the `/img/` rewrite in
// `vercel.json`); the service worker resolves these against its own origin when building the runtime manifest.
const EXTERNAL_IMG_BASE = "img/";

// Set to store unique image URLs
const imageUrls = new Set();

/**
 * Recursively search for image references in an object/array
 */
function extractImageUrls (obj, path = "") {
	if (typeof obj === "string") {
		const imageExtensions = [".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif"];
		const lower = obj.toLowerCase();
		const hasImageExtension = imageExtensions.some(ext => lower.includes(ext));

		if (!hasImageExtension) return;

		// Reject changelog / prose strings that merely mention image extensions
		if (
			obj.includes("\n")
			|| obj.includes("{@")
			|| obj.includes("`")
			|| obj.length > 260
			|| /\s-\s/.test(obj)
		) {
			return;
		}

		let imagePath = obj.replace(/^\/+/, "");

		// Drop query/hash fragments if present
		imagePath = imagePath.split(/[?#]/)[0];

		// Must look like a relative media path ending in an image extension
		const looksLikePath = /^(?:img\/)?[\w./()\- %[\]']+\.(?:webp|png|jpe?g|svg|gif)$/i.test(imagePath);
		if (!looksLikePath) return;

		if (imagePath.startsWith("img/")) {
			imagePath = imagePath.replace(/^img\//, "");
		} else if (imagePath.startsWith("http")) {
			return;
		} else if (!imagePath.includes("/")) {
			console.log(`  Skipping non-path image reference: "${imagePath}" in ${path}`);
			return;
		}

		// Encode path segments so spaces/special chars match browser request URLs
		const encodedPath = imagePath
			.split("/")
			.map(seg => encodeURIComponent(decodeURIComponent(seg)))
			.join("/");

		imageUrls.add(EXTERNAL_IMG_BASE + encodedPath);
	} else if (Array.isArray(obj)) {
		obj.forEach((item, index) => extractImageUrls(item, `${path}[${index}]`));
	} else if (obj && typeof obj === "object") {
		Object.entries(obj).forEach(([key, value]) => {
			extractImageUrls(value, path ? `${path}.${key}` : key);
		});
	}
}

// Entity props which have tokens, mapped to the media directory those tokens live in.
// See `Renderer.generic.getTokenUrl`.
const TOKEN_PROP_TO_MEDIA_DIR = {
	"monster": "bestiary/tokens",
	"object": "objects/tokens",
	"vehicle": "vehicles/tokens",
};

// See `String.prototype.toAscii` and `Parser.nameToTokenName`
const nameToTokenName = (name) => name
	.normalize("NFD")
	.replace(/[\u0300-\u036f]/g, "")
	.replace(/Æ/g, "AE").replace(/æ/g, "ae")
	.replace(/"/g, "");

const addTokenUrl = ({mediaDir, source, name}) => {
	if (!source || !name) return;
	imageUrls.add(`${EXTERNAL_IMG_BASE}${mediaDir}/${encodeURIComponent(source)}/${encodeURIComponent(nameToTokenName(name))}.webp`);
};

/**
 * Tokens are usually implicit—derived from the entity's name and source at render time, rather than stored as a
 * path in the data—so they are invisible to the generic string scan above.
 */
function extractTokenUrls (data) {
	for (const [prop, mediaDir] of Object.entries(TOKEN_PROP_TO_MEDIA_DIR)) {
		const ents = data[prop];
		if (!Array.isArray(ents)) continue;

		for (const ent of ents) {
			if (ent.tokenUrl || ent.tokenHref) continue; // explicit URLs are already handled by the string scan

			if (ent.token) addTokenUrl({mediaDir, source: ent.token.source, name: ent.token.name});
			else if (ent.hasToken) addTokenUrl({mediaDir, source: ent.source, name: ent.name});

			(ent.variant || [])
				.filter(it => it.token)
				.forEach(it => addTokenUrl({mediaDir, source: it.token.source, name: it.token.name}));

			(ent.altArt || [])
				.forEach(alt => addTokenUrl({mediaDir, source: alt.source, name: alt.name}));

			Object.values(ent._versions || {})
				.flat()
				.filter(ver => ver && ver.name)
				.forEach(ver => addTokenUrl({mediaDir, source: ver.source || ent.source, name: ver.name}));
		}
	}
}

/**
 * Process a single JSON file
 */
function processJsonFile (filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8");
		const data = JSON.parse(content);
		extractImageUrls(data);
		extractTokenUrls(data);
	} catch (error) {
		console.warn(`Warning: Could not process ${filePath}:`, error.message);
	}
}

/**
 * Recursively scan directory for JSON files
 */
function scanDirectory (dirPath) {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry.name);

		if (entry.isDirectory()) {
			scanDirectory(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".json")) {
			processJsonFile(fullPath);
		}
	}
}

/**
 * Add some common image patterns that might not be in the data files
 */
function addCommonImagePatterns () {
	// Add common bestiary image patterns
	const commonPatterns = [
		// Bestiary tokens - common patterns
		"bestiary/tokens/",
		"bestiary/",
		// Book covers and content
		"covers/",
		"book/",
		// Adventure content
		"adventure/",
		// Items and equipment
		"items/",
		// Spells
		"spells/",
		// Classes and subclasses
		"classes/",
		// Races
		"races/",
		// Deities
		"deities/",
		// Maps
		"maps/",
	];

	// Note: We can't generate specific URLs without the actual filenames,
	// so we'll just add these as patterns for manual inclusion if needed
	console.log("Common image directory patterns to consider:");
	commonPatterns.forEach(pattern => {
		console.log(`  ${EXTERNAL_IMG_BASE}${pattern}**/*`);
	});
}

/**
 * Main execution
 */
function main () {
	console.log("🔍 Scanning for image references in JSON data files...");

	const dataDir = path.join(projectRoot, "data");

	if (!fs.existsSync(dataDir)) {
		console.error("Error: data directory not found at", dataDir);
		process.exit(1);
	}

	// Scan all JSON files in the data directory
	scanDirectory(dataDir);

	// Homebrew/prerelease content is precached as JSON, so its images should be preloadable too
	for (const dirName of ["homebrew", "prerelease"]) {
		const dirPath = path.join(projectRoot, dirName);
		if (fs.existsSync(dirPath)) scanDirectory(dirPath);
	}

	// Convert Set to sorted array
	const sortedUrls = Array.from(imageUrls).sort();

	console.log(`\n📊 Found ${sortedUrls.length} unique image URLs:`);

	if (sortedUrls.length === 0) {
		console.log("\n⚠️  No image URLs found in JSON data files.");
		console.log("This might indicate that:");
		console.log("1. Images are referenced dynamically in code");
		console.log("2. Image paths are stored in a different format");
		console.log("3. Images are referenced by filename only, not full paths\n");

		addCommonImagePatterns();
	} else {
		// Output the URLs
		sortedUrls.forEach(url => console.log(`  ${url}`));

		// Write to a file for use in build process
		const outputFile = path.join(projectRoot, "image-urls.json");
		const outputData = {
			generated: new Date().toISOString(),
			baseUrl: EXTERNAL_IMG_BASE,
			count: sortedUrls.length,
			urls: sortedUrls,
		};

		fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
		console.log(`\n💾 Saved image URLs to: ${outputFile}`);
	}

	console.log("\n✅ Scan complete!");
}

// Run the script
main();
