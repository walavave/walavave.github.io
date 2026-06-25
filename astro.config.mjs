// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import starlightThemeNova from 'starlight-theme-nova';

// https://astro.build/config
export default defineConfig({
	site: 'https://walavave.github.io',
	integrations: [
		react(),
		starlight({
			title: {
				'zh-CN': '论文文档',
				en: 'Paper Docs',
			},
			locales: {
				root: {
					label: '简体中文',
					lang: 'zh-CN',
				},
				en: {
					label: 'English',
					lang: 'en',
				},
			},
			defaultLocale: 'root',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{
							label: 'Example Guide',
							slug: 'guides/example',
						},
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
			components: {
				PageFrame: './src/components/starlight/PageFrame.astro',
				PageTitle: './src/components/starlight/PageTitle.astro',
			},
			plugins: [
				starlightThemeNova({
					nav: [
						{
							label: {
								root: '文档',
								en: 'Docs',
							},
							href: {
								root: '/',
								en: '/en/',
							},
						},
						{
							label: {
								root: '列表',
								en: 'List',
							},
							href: {
								root: '/list/',
								en: '/en/list/',
							},
						},
					],
				}),
			],
		}),
	],
});
