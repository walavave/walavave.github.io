import { defineCollection, z } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

const articleLinkSchema = z
	.object({
		arxiv: z.string().url().optional(),
		website: z.string().url().optional(),
		youtube: z.string().url().optional(),
		github: z.string().url().optional(),
	})
	.strict();

const platformValueSchema = z.union([z.string(), z.array(z.string())]);

const articlePlatformSchema = z
	.object({
		train: platformValueSchema.optional(),
		simulate: platformValueSchema.optional(),
		deploy: platformValueSchema.optional(),
	})
	.strict();

const tagValueSchema = z.union([z.string(), z.array(z.string())]);
const publishValueSchema = z.union([
	z.string(),
	z.date().transform((value) => value.toISOString().slice(0, 10)),
]);

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				hideSidebar: z.boolean().optional().default(false),
				publish: publishValueSchema.optional(),
				link: z.union([articleLinkSchema, z.array(articleLinkSchema)]).optional(),
				platform: z.union([articlePlatformSchema, z.array(articlePlatformSchema)]).optional(),
				jc: z.string().optional(),
				tags: tagValueSchema.optional(),
			}),
		}),
	}),
	i18n: defineCollection({
		loader: i18nLoader(),
		schema: i18nSchema({
			extend: z
				.object({
					'pageTitle.copy': z.string(),
					'pageTitle.copied': z.string(),
					'pageTitle.view': z.string(),
					'pageTitle.chatgpt': z.string(),
					'pageTitle.claude': z.string(),
					'pageTitle.lechat': z.string(),
					'pageTitle.grok': z.string(),
					'pageTitle.openMenu': z.string(),
					'pageTitle.assistantPrompt': z.string(),
					'paperLinkRail.railLabel': z.string(),
					'paperLinkRail.arxiv': z.string(),
					'paperLinkRail.website': z.string(),
					'paperLinkRail.youtube': z.string(),
					'paperLinkRail.github': z.string(),
					'paperLinkRail.train': z.string(),
					'paperLinkRail.simulate': z.string(),
					'paperLinkRail.deploy': z.string(),
					'paperStatus.title': z.string(),
					'paperStatus.description': z.string(),
					'paperStatus.link.arxiv': z.string(),
					'paperStatus.link.website': z.string(),
					'paperStatus.link.youtube': z.string(),
					'paperStatus.link.github': z.string(),
					'paperStatus.tableAriaLabel': z.string(),
					'paperStatus.filtersAriaLabel': z.string(),
					'paperStatus.searchPlaceholder': z.string(),
					'paperStatus.resetFilters': z.string(),
					'paperStatus.filter.tags': z.string(),
					'paperStatus.filter.train': z.string(),
					'paperStatus.filter.simulate': z.string(),
					'paperStatus.filter.deploy': z.string(),
					'paperStatus.filter.jc': z.string(),
					'paperStatus.column.paper': z.string(),
					'paperStatus.column.links': z.string(),
					'paperStatus.column.publish': z.string(),
					'paperStatus.column.train': z.string(),
					'paperStatus.column.simulate': z.string(),
					'paperStatus.column.deploy': z.string(),
					'paperStatus.column.jc': z.string(),
					'paperStatus.column.tags': z.string(),
					'paperStatus.emptyOptions': z.string(),
					'paperStatus.emptyState': z.string(),
					'paperStatus.totalCount': z.string(),
					'paperStatus.resultCount': z.string(),
				})
				.partial(),
		}),
	}),
};
