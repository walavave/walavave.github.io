import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const papersContentRoot = path.join(projectRoot, 'src', 'content', 'docs', 'papers');
const papersPublicRoot = path.join(projectRoot, 'public', 'papers');

function fail(message) {
	console.error(message);
	process.exit(1);
}

function getPaperFolderName(markdownArg) {
	const parsed = path.parse(markdownArg);
	if (!parsed.base) {
		fail(`Invalid paper file name: ${markdownArg}`);
	}
	if (!['.md', '.mdx'].includes(parsed.ext.toLowerCase())) {
		fail(`Paper file must end with .md or .mdx: ${markdownArg}`);
	}
	return parsed.name;
}

function collectImageReferences(markdown) {
	const markdownImageRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
	const htmlImageRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
	const matches = [];

	for (const regex of [markdownImageRegex, htmlImageRegex]) {
		let match;
		while ((match = regex.exec(markdown)) !== null) {
			matches.push(match[1]);
		}
	}

	return matches;
}

function isLocalImageReference(reference) {
	if (/^(https?:)?\/\//i.test(reference)) return false;
	if (reference.startsWith('/')) return false;
	if (reference.startsWith('#')) return false;
	return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(reference);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceImageReference(input, search, replacement) {
	const escaped = escapeRegExp(search);
	const markdownImage = new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}((?:\\s+"[^"]*")?\\))`, 'g');
	const htmlImage = new RegExp(`(<img\\b[^>]*\\bsrc=["'])${escaped}(["'][^>]*>)`, 'gi');

	return input
		.replace(markdownImage, `$1${replacement}$2`)
		.replace(htmlImage, `$1${replacement}$2`);
}

async function ensureFileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const markdownArg = process.argv[2];
	if (!markdownArg) {
		fail('Usage: node scripts/organize-paper-images.mjs <paper-file-name>');
	}

	const markdownFileName = path.basename(markdownArg);
	const folderName = getPaperFolderName(markdownFileName);
	const markdownPath = path.join(papersContentRoot, markdownFileName);
	const markdownDir = path.dirname(markdownPath);
	if (!(await ensureFileExists(markdownPath))) {
		fail(`Paper file not found: src/content/docs/papers/${markdownFileName}`);
	}
	const markdownRaw = await fs.readFile(markdownPath, 'utf8');
	const targetDir = path.join(papersPublicRoot, folderName);
	await fs.mkdir(targetDir, { recursive: true });

	const references = collectImageReferences(markdownRaw).filter(isLocalImageReference);
	if (references.length === 0) {
		console.log(`No local image references found in src/content/docs/papers/${markdownFileName}`);
		return;
	}

	const uniqueReferences = [...new Set(references)];
	let nextIndex = 1;
	let markdownNext = markdownRaw;

	for (const reference of uniqueReferences) {
		const sourcePath = path.resolve(markdownDir, reference);
		if (!(await ensureFileExists(sourcePath))) {
			console.warn(`Skip missing file: ${reference}`);
			continue;
		}

		const extension = path.extname(sourcePath).toLowerCase();
		let targetPath;
		let publicPath;

		do {
			targetPath = path.join(targetDir, `${nextIndex}${extension}`);
			publicPath = `/papers/${folderName}/${nextIndex}${extension}`;
			nextIndex += 1;
		} while (await ensureFileExists(targetPath));

		await fs.rename(sourcePath, targetPath);
		markdownNext = replaceImageReference(markdownNext, reference, publicPath);
		console.log(`${reference} -> ${publicPath}`);
	}

	await fs.writeFile(markdownPath, markdownNext, 'utf8');
}

await main();
