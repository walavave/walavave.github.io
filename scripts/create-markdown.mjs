import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const templatePath = path.join(projectRoot, 'scripts', 'template.md');
const papersRoot = path.join(projectRoot, 'src', 'content', 'docs', 'papers');

function fail(message) {
	console.error(message);
	process.exit(1);
}

function getToday() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

function getMarkdownFileName(value) {
	if (!value) {
		fail('Usage: npm run md -- <file-name.md>');
	}

	const fileName = path.basename(value);
	const extension = path.extname(fileName).toLowerCase();

	if (!fileName || !['.md', '.mdx'].includes(extension)) {
		fail(`Markdown file must end with .md or .mdx: ${value}`);
	}

	return fileName;
}

function ensureClosingSeparatorAfterLastUpdated(template) {
	// 确保 lastUpdated 行后面紧跟 frontmatter 结束的 "---"
	const replaced = template.replace(
		/^(lastUpdated:\s*.*)$(\n(?!---$).*)$/m,
		'$1\n---$2'
	);
	return replaced;
}

function fillLastUpdated(template, date) {
	let next = template.replace(/^lastUpdated:\s*.*$/m, `lastUpdated: ${date}`);

	if (next === template) {
		next = template.replace(/^lastUpdate:\s*.*$/m, `lastUpdate: ${date}`);
	}

	return ensureClosingSeparatorAfterLastUpdated(next);
}

async function main() {
	const fileName = getMarkdownFileName(process.argv[2]);
	const targetPath = path.join(papersRoot, fileName);

	if (await exists(targetPath)) {
		fail(`File already exists: src/content/docs/papers/${fileName}`);
	}

	const template = await fs.readFile(templatePath, 'utf8');
	const content = fillLastUpdated(template, getToday());

	await fs.mkdir(papersRoot, { recursive: true });
	await fs.writeFile(targetPath, content, 'utf8');

	console.log(`Created src/content/docs/papers/${fileName}`);
}

await main();
