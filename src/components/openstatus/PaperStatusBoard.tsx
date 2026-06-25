import { useMemo, useState } from 'react';
import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import './paper-status-board.css';

export interface PaperBoardLink {
	key: 'arxiv' | 'website' | 'youtube' | 'github';
	label: string;
	href?: string;
}

export interface PaperBoardItem {
	id: string;
	title: string;
	href: string;
	publish: string;
	jc: string[];
	links: PaperBoardLink[];
	train: string[];
	simulate: string[];
	deploy: string[];
	tags: string[];
}

type ArrayFilterKey = 'tags' | 'train' | 'simulate' | 'deploy' | 'jc';

interface PaperStatusBoardLabels {
	tableAriaLabel: string;
	filtersAriaLabel: string;
	searchPlaceholder: string;
	resetFilters: string;
	emptyOptions: string;
	emptyState: string;
	resultCount: string;
	totalCount: string;
	filters: Record<ArrayFilterKey, string>;
	columns: {
		paper: string;
		links: string;
		publish: string;
			jc: string;
		train: string;
		simulate: string;
		deploy: string;
		tags: string;
	};
}

interface PaperStatusBoardProps {
	papers: PaperBoardItem[];
	labels: PaperStatusBoardLabels;
}

const websiteIconPath = (
	<g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18" />
		<path d="M12 3a15 15 0 0 1 0 18" />
		<path d="M12 3a15 15 0 0 0 0 18" />
	</g>
);

function LinkIcon({ kind }: { kind: PaperBoardLink['key'] }) {
	if (kind === 'arxiv') {
		return (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V8.56a2.75 2.75 0 0 0-.8-1.95l-2.81-2.8A2.75 2.75 0 0 0 14.45 3H6.75Zm0 1.5h7.5v3.25c0 .97.78 1.75 1.75 1.75h2.5v8.75c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V5.75c0-.69.56-1.25 1.25-1.25Zm9 .56 2.19 2.19c.14.14.24.31.31.5H16a.25.25 0 0 1-.25-.25V5.06ZM8 11.25c0-.41.34-.75.75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 8 11.25Zm0 3.5c0-.41.34-.75.75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 8 14.75Zm0 3.5c0-.41.34-.75.75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 8 18.25Z"
				/>
			</svg>
		);
	}

	if (kind === 'website') {
		return (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{websiteIconPath}
			</svg>
		);
	}

	if (kind === 'youtube') {
		return (
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M21.58 7.19a2.97 2.97 0 0 0-2.09-2.1C17.64 4.58 12 4.58 12 4.58s-5.64 0-7.49.5a2.97 2.97 0 0 0-2.09 2.1C1.92 9.04 1.92 12 1.92 12s0 2.96.5 4.81a2.97 2.97 0 0 0 2.09 2.1c1.85.5 7.49.5 7.49.5s5.64 0 7.49-.5a2.97 2.97 0 0 0 2.09-2.1c.5-1.85.5-4.81.5-4.81s0-2.96-.5-4.81ZM10.2 15.06V8.94L15.55 12l-5.35 3.06Z"
				/>
			</svg>
		);
	}

	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="currentColor"
				d="M12 .5C5.65.5.5 5.8.5 12.33c0 5.22 3.3 9.65 7.88 11.21.58.11.79-.26.79-.58 0-.29-.01-1.06-.02-2.08-3.2.72-3.88-1.6-3.88-1.6-.52-1.37-1.28-1.73-1.28-1.73-1.05-.74.08-.73.08-.73 1.16.09 1.77 1.25 1.77 1.25 1.03 1.84 2.7 1.31 3.35 1 .1-.77.4-1.31.72-1.61-2.56-.3-5.26-1.33-5.26-5.94 0-1.31.45-2.38 1.19-3.22-.12-.3-.52-1.51.11-3.15 0 0 .97-.32 3.19 1.23A10.7 10.7 0 0 1 12 5.89c.95 0 1.91.13 2.81.38 2.22-1.55 3.19-1.23 3.19-1.23.64 1.64.24 2.85.12 3.15.74.84 1.19 1.91 1.19 3.22 0 4.62-2.7 5.63-5.28 5.93.41.37.78 1.11.78 2.24 0 1.62-.02 2.93-.02 3.33 0 .32.21.69.8.58 4.57-1.56 7.87-5.99 7.87-11.21C23.5 5.8 18.35.5 12 .5Z"
			/>
		</svg>
	);
}

const ARRAY_FILTERS: ArrayFilterKey[] = [
	'jc',
	'tags',
	'train',
	'simulate',
	'deploy',
];

function collectFacetOptions(papers: PaperBoardItem[], key: ArrayFilterKey) {
	const counts = new Map<string, number>();
	for (const paper of papers) {
		for (const value of paper[key]) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => a.value.localeCompare(b.value, 'zh-Hans-CN'));
}

function arrayIncludesAny(rowValues: string[], filterValue: unknown) {
	if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
	return filterValue.some((value) => typeof value === 'string' && rowValues.includes(value));
}

function toggleArrayValue(values: string[], value: string) {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatMessage(template: string, values: Record<string, string | number>) {
	return template.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ''));
}

function SortHeader({
	children,
	sorted,
}: {
	children: React.ReactNode;
	sorted: false | 'asc' | 'desc';
}) {
	return (
		<span className="psb-sort-header">
			{children}
			<span className="psb-sort-arrows" aria-hidden="true">
				<span className={sorted === 'asc' ? 'is-active' : ''}>▲</span>
				<span className={sorted === 'desc' ? 'is-active' : ''}>▼</span>
			</span>
		</span>
	);
}

function ChipList({
	values,
	activeValues,
	onToggle,
}: {
	values: string[];
	activeValues: string[];
	onToggle: (value: string) => void;
}) {
	if (values.length === 0) return <span className="psb-empty">-</span>;
	return (
		<span className="psb-chip-list">
			{values.map((value) => (
				<button
					key={value}
					type="button"
					className={`psb-chip ${activeValues.includes(value) ? 'is-active' : ''}`}
					onClick={(event) => {
						event.stopPropagation();
						onToggle(value);
					}}
				>
					{value}
				</button>
			))}
		</span>
	);
}

export function PaperStatusBoard({ papers, labels }: PaperStatusBoardProps) {
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [openFilter, setOpenFilter] = useState<ArrayFilterKey | null>(null);

	const filteredBySearch = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return papers;
		return papers.filter((paper) => {
			const fields = [
				paper.title,
				paper.publish,
				...paper.tags,
				...paper.train,
				...paper.simulate,
				...paper.deploy,
			];
			return fields.some((field) => field.toLowerCase().includes(query));
		});
	}, [papers, search]);

	const facetOptions = useMemo(() => {
		return Object.fromEntries(
			ARRAY_FILTERS.map((filter) => [filter, collectFacetOptions(filteredBySearch, filter)]),
		) as Record<ArrayFilterKey, { value: string; count: number }[]>;
	}, [filteredBySearch]);

	const selectedFilters = useMemo(() => {
		return Object.fromEntries(
			ARRAY_FILTERS.map((filter) => {
				const value = columnFilters.find((item) => item.id === filter)?.value;
				return [filter, Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []];
			}),
		) as Record<ArrayFilterKey, string[]>;
	}, [columnFilters]);

	function setArrayFilter(id: ArrayFilterKey, values: string[]) {
		setColumnFilters((current) => {
			const rest = current.filter((filter) => filter.id !== id);
			return values.length > 0 ? [...rest, { id, value: values }] : rest;
		});
	}

	function toggleFilterValue(id: ArrayFilterKey, value: string) {
		setArrayFilter(id, toggleArrayValue(selectedFilters[id], value));
	}

	function resetFilters() {
		setSearch('');
		setColumnFilters([]);
		setOpenFilter(null);
	}

	const columns = useMemo<ColumnDef<PaperBoardItem>[]>(() => [
		{
			id: 'title',
			accessorKey: 'title',
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.paper}</SortHeader>
				</button>
			),
			cell: ({ row }) => {
				const paper = row.original;
				return (
					<div className="psb-paper-cell">
						<a href={paper.href} className="psb-paper-title">
							{paper.title}
						</a>
					</div>
				);
			},
			size: 320,
		},
		{
			id: 'links',
			accessorFn: (row) => row.links.filter((link) => link.href).length,
			header: labels.columns.links,
			cell: ({ row }) => {
				const paper = row.original;
				return (
					<div className="psb-paper-links" aria-label={`${paper.title} links`}>
						{paper.links.map((link) => (
							link.href ? (
								<a
									key={link.key}
									href={link.href}
									target="_blank"
									rel="noreferrer"
									aria-label={link.label}
									title={link.label}
									className="psb-paper-link-icon"
								>
									<LinkIcon kind={link.key} />
								</a>
							) : (
								<span
									key={link.key}
									aria-label={link.label}
									title={link.label}
									className="psb-paper-link-icon is-disabled"
								>
									<LinkIcon kind={link.key} />
								</span>
							)
						))}
					</div>
				);
			},
			size: 132,
		},
		{
			id: 'publish',
			accessorKey: 'publish',
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.publish}</SortHeader>
				</button>
			),
			cell: ({ row }) => row.original.publish || <span className="psb-empty">-</span>,
			size: 140,
		},
		{
			id: 'jc',
			accessorFn: (row) => row.jc.length,
			filterFn: (row, _id, value) => arrayIncludesAny(row.original.jc, value),
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.jc}</SortHeader>
				</button>
			),
			cell: ({ row }) => (
				<ChipList
					values={row.original.jc}
					activeValues={selectedFilters.jc}
					onToggle={(value) => toggleFilterValue('jc', value)}
				/>
			),
			size: 170,
		},
		{
			id: 'train',
			accessorFn: (row) => row.train.length,
			filterFn: (row, _id, value) => arrayIncludesAny(row.original.train, value),
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.train}</SortHeader>
				</button>
			),
			cell: ({ row }) => (
				<ChipList
					values={row.original.train}
					activeValues={selectedFilters.train}
					onToggle={(value) => toggleFilterValue('train', value)}
				/>
			),
			size: 170,
		},
		{
			id: 'simulate',
			accessorFn: (row) => row.simulate.length,
			filterFn: (row, _id, value) => arrayIncludesAny(row.original.simulate, value),
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.simulate}</SortHeader>
				</button>
			),
			cell: ({ row }) => (
				<ChipList
					values={row.original.simulate}
					activeValues={selectedFilters.simulate}
					onToggle={(value) => toggleFilterValue('simulate', value)}
				/>
			),
			size: 190,
		},
		{
			id: 'deploy',
			accessorFn: (row) => row.deploy.length,
			filterFn: (row, _id, value) => arrayIncludesAny(row.original.deploy, value),
			header: ({ column }) => (
				<button
					type="button"
					className="psb-head-button"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					<SortHeader sorted={column.getIsSorted()}>{labels.columns.deploy}</SortHeader>
				</button>
			),
			cell: ({ row }) => (
				<ChipList
					values={row.original.deploy}
					activeValues={selectedFilters.deploy}
					onToggle={(value) => toggleFilterValue('deploy', value)}
				/>
			),
			size: 170,
		},
		{
			id: 'tags',
			accessorKey: 'tags',
			filterFn: (row, _id, value) => arrayIncludesAny(row.original.tags, value),
			header: labels.columns.tags,
			cell: ({ row }) => (
				<ChipList
					values={row.original.tags}
					activeValues={selectedFilters.tags}
					onToggle={(value) => toggleFilterValue('tags', value)}
				/>
			),
			enableSorting: false,
			size: 180,
		},
	], [labels.columns, selectedFilters]);

	const table = useReactTable({
		data: filteredBySearch,
		columns,
		state: {
			sorting,
			columnFilters,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const rows = table.getRowModel().rows;
	const hasFilters = search.trim().length > 0 || columnFilters.length > 0;

	return (
		<section className="psb" aria-label={labels.tableAriaLabel}>
			<div className="psb-toolbar">
				<label className="psb-search">
					<span className="psb-search-icon" aria-hidden="true">⌕</span>
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={labels.searchPlaceholder}
					/>
				</label>
				<div className="psb-toolbar-filters" aria-label={labels.filtersAriaLabel}>
					{ARRAY_FILTERS.map((filter) => (
						<div
							key={filter}
							className={`psb-filter-menu ${openFilter === filter ? 'is-open' : ''}`}
						>
							<button
								type="button"
								className="psb-filter-trigger"
								aria-expanded={openFilter === filter}
								onClick={() =>
									setOpenFilter((current) => (current === filter ? null : filter))
								}
							>
								<span>{labels.filters[filter]}</span>
								{selectedFilters[filter].length > 0 && (
									<span className="psb-filter-count">{selectedFilters[filter].length}</span>
								)}
							</button>
						</div>
					))}
				</div>
				<div className="psb-toolbar-meta">
					<span className="psb-result-count">
						{formatMessage(labels.resultCount, { shown: rows.length, total: papers.length })}
					</span>
					{hasFilters && (
						<button type="button" className="psb-reset" onClick={resetFilters}>
							{labels.resetFilters}
						</button>
					)}
				</div>
			</div>
			{openFilter && (
				<div className="psb-filter-panel" aria-label={labels.filters[openFilter]}>
					<div className="psb-filter-chip-list">
						{facetOptions[openFilter].length > 0 ? (
							facetOptions[openFilter].map((option) => {
								const active = selectedFilters[openFilter].includes(option.value);
								return (
									<button
										key={option.value}
										type="button"
										className={`psb-chip ${active ? 'is-active' : ''}`}
										onClick={() => toggleFilterValue(openFilter, option.value)}
									>
										<span className="psb-chip-label">{option.value}</span>
										<span className="psb-chip-count">{option.count}</span>
									</button>
								);
							})
						) : (
							<span className="psb-no-options">{labels.emptyOptions}</span>
						)}
					</div>
				</div>
			)}

			<div className="psb-table-card">
				<div className="psb-table-scroll">
					<table className="psb-table">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className={header.column.id === 'title' ? 'psb-col-title' : undefined}
											style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
										>
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{rows.length > 0 ? (
								rows.map((row) => (
									<tr key={row.id}>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className={cell.column.id === 'title' ? 'psb-col-title' : undefined}>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))
							) : (
								<tr>
									<td colSpan={columns.length} className="psb-empty-state">
										{labels.emptyState}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="psb-footer">
				{formatMessage(labels.totalCount, { count: rows.length })}
			</div>
		</section>
	);
}

export default PaperStatusBoard;
