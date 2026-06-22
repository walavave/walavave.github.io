// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import starlightThemeNova from 'starlight-theme-nova'

// https://astro.build/config
export default defineConfig({
	site: 'https://walavave.github.io',
	integrations: [
		react(),
		starlight({
			title: 'My Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' },
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
							root: 'Docs',
							'zh-CN': '文档',
						},
						href: {
							root: '/',
							'zh-CN': '/',
						},
						},
						{
						label: {
							root: 'Changelog',
							'zh-CN': '更新日志',
						},
						href: 'https://github.com/ocavue/starlight-theme-nova/blob/master/packages/starlight-theme-nova/CHANGELOG.md',
						},
						{
						label: 'List',
						href: '/list/',
						},
					],
				}), 
			]
		}),
	],
});
