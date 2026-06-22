import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface MarkdownRouteProps {
	body?: string;
	filePath?: string;
}

function toMarkdownRouteSlug(id: string) {
	const normalizedId = id === 'index' ? '' : id;
	return normalizedId ? `${normalizedId}/index` : 'index';
}

export async function getStaticPaths() {
	const docs = await getCollection('docs');

	return docs.map((entry) => ({
		params: { slug: toMarkdownRouteSlug(entry.id) },
		props: {
			body: entry.body,
			filePath: entry.filePath,
		} satisfies MarkdownRouteProps,
	}));
}

export async function GET({ props }: { props: MarkdownRouteProps }) {
	const { body = '', filePath } = props;
	let markdown = body;

	if (filePath) {
		try {
			markdown = await readFile(path.join(process.cwd(), filePath), 'utf-8');
		} catch {
			markdown = body;
		}
	}

	return new Response(markdown, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
		},
	});
}
