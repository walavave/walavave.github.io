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
	label: string;
	href?: string;
}

export interface PaperBoardItem {
	id: string;
	title: string;
	href: string;
	links: PaperBoardLink[];
	train: string[];
	simulate: string[];
	deploy: string[];
	tags: string[];
}

interface PaperStatusBoardProps {
	papers: PaperBoardItem[];
}

type ArrayFilterKey = 'tags' | 'train' | 'simulate' | 'deploy';

const ARRAY_FILTERS: { id: ArrayFilterKey; label: string }[] = [
	{ id: 'tags', label: '研究方向' },
	{ id: 'train', label: 'Train' },
	{ id: 'simulate', label: 'Simulate' },
	{ id: 'deploy', label: 'Deploy' },
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

export function PaperStatusBoard({ papers }: PaperStatusBoardProps) {
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const filteredBySearch = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return papers;
		return papers.filter((paper) => {
			const fields = [
				paper.title,
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
			ARRAY_FILTERS.map((filter) => [filter.id, collectFacetOptions(filteredBySearch, filter.id)]),
		) as Record<ArrayFilterKey, { value: string; count: number }[]>;
	}, [filteredBySearch]);

	const selectedFilters = useMemo(() => {
		return Object.fromEntries(
			ARRAY_FILTERS.map((filter) => {
				const value = columnFilters.find((item) => item.id === filter.id)?.value;
				return [filter.id, Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []];
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
					<SortHeader sorted={column.getIsSorted()}>Paper</SortHeader>
				</button>
			),
			cell: ({ row }) => {
				const paper = row.original;
				const links = paper.links.filter((link) => link.href);
				return (
					<div className="psb-paper-cell">
						<a href={paper.href} className="psb-paper-title">
							{paper.title}
						</a>
						{links.length > 0 && (
							<div className="psb-paper-links">
								{links.map((link) => (
									<a key={link.label} href={link.href} target="_blank" rel="noreferrer">
										{link.label}
									</a>
								))}
							</div>
						)}
					</div>
				);
			},
			size: 320,
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
					<SortHeader sorted={column.getIsSorted()}>Train</SortHeader>
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
					<SortHeader sorted={column.getIsSorted()}>Simulate</SortHeader>
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
					<SortHeader sorted={column.getIsSorted()}>Deploy</SortHeader>
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
			header: '研究方向',
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
	], [selectedFilters]);

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
		<section className="psb" aria-label="Paper status table">
			<div className="psb-toolbar">
				<label className="psb-search">
					<span className="psb-search-icon" aria-hidden="true">⌕</span>
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="搜索标题、平台或标签..."
					/>
				</label>
				{hasFilters && (
					<button type="button" className="psb-reset" onClick={resetFilters}>
						重置筛选
					</button>
				)}
			</div>

			<div className="psb-layout">
				<aside className="psb-filters" aria-label="Table filters">
					<div className="psb-filter-header">
						<span>Filters</span>
						<span>{rows.length}/{papers.length}</span>
					</div>
					{ARRAY_FILTERS.map((filter) => (
						<details key={filter.id} className="psb-filter" open={filter.id === 'tags' || filter.id === 'train'}>
							<summary>
								<span>{filter.label}</span>
								{selectedFilters[filter.id].length > 0 && (
									<span className="psb-filter-count">{selectedFilters[filter.id].length}</span>
								)}
							</summary>
							<div className="psb-filter-options">
								{facetOptions[filter.id].length > 0 ? (
									facetOptions[filter.id].map((option) => {
										const checked = selectedFilters[filter.id].includes(option.value);
										return (
											<label key={option.value} className="psb-option">
												<input
													type="checkbox"
													checked={checked}
													onChange={() => toggleFilterValue(filter.id, option.value)}
												/>
												<span>{option.value}</span>
												<span className="psb-option-count">{option.count}</span>
											</label>
										);
									})
								) : (
									<span className="psb-no-options">无可用选项</span>
								)}
							</div>
						</details>
					))}
				</aside>

				<div className="psb-table-card">
					<div className="psb-table-scroll">
						<table className="psb-table">
							<thead>
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
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
												<td key={cell.id}>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											))}
										</tr>
									))
								) : (
									<tr>
										<td colSpan={columns.length} className="psb-empty-state">
											未找到匹配的论文
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div className="psb-footer">
				共 {rows.length} 篇论文
			</div>
		</section>
	);
}

export default PaperStatusBoard;
