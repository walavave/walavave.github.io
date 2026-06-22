import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

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

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				hideSidebar: z.boolean().optional().default(false),
				link: z.union([articleLinkSchema, z.array(articleLinkSchema)]).optional(),
				platform: z.union([articlePlatformSchema, z.array(articlePlatformSchema)]).optional(),
			}),
		}),
	}),
};
