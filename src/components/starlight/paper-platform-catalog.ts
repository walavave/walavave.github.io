export interface PlatformCatalogEntry {
	thumbnail?: string;
	href?: string;
}

export const platformCatalog: Record<string, PlatformCatalogEntry> = {
	'Nvidia H100': {
		href: 'https://www.nvidia.com/en-us/data-center/h100/',
	},
	'Isaac Lab': {
		thumbnail: '/platforms/isaac-lab.png',
		href: 'https://isaac-sim.github.io/IsaacLab/',
	},
	Mujoco: {
		thumbnail: '/platforms/mujoco.png',
		href: 'https://mujoco.readthedocs.io/en/stable/',
	},
	'Unitree G1': {
		thumbnail: '/platforms/unitree-g1.png',
		href: 'https://www.unitree.com/g1/',
	},
};
