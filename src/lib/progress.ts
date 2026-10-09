import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  persistAdminFileTransaction
} from './admin-console/admin-api';
import { withAdminContentWriteLock } from './admin-console/content-write-lock';

export type ProgressTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type ProgressDay = {
  date: string;
  exists: boolean;
  tasks: ProgressTask[];
};

export type ProgressState = {
  years: number[];
  days: Record<string, ProgressTask[]>;
};

export type ProgressMutation =
  | { action: 'add'; date: string; text: string; completed?: boolean }
  | { action: 'toggle'; date: string; taskIndex: number }
  | { action: 'update'; date: string; taskIndex: number; text: string }
  | { action: 'remove'; date: string; taskIndex: number };

const PROGRESS_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PROGRESS_MONTH_RE = /^(\d{2}|\d{4})-(\d{1,2})$/;
const PROGRESS_DAY_FILE_RE = /^(\d{1,2})\.md$/i;
const PROGRESS_TASK_RE = /^\s*(?:[-*+]\s+)?\[\s*([xX]?)\s*\]\s*(.*?)\s*$/;
const MAX_TASK_LENGTH = 500;

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

export const getProgressRoot = (): string => path.join(getProjectRoot(), 'src', 'content', 'progress');

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() + 1 === month
    && value.getUTCDate() === day;
};

export const normalizeProgressDate = (value: string): string | null => {
  const match = PROGRESS_DATE_RE.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const formatProgressDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseProgressMonth = (value: string): { year: number; month: number } | null => {
  const match = PROGRESS_MONTH_RE.exec(value);
  if (!match) return null;

  const rawYear = match[1] ?? '';
  const month = Number(match[2]);
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  if (month < 1 || month > 12 || year < 1) return null;
  return { year, month };
};

const getProgressRelativePath = (date: string): string => {
  const normalized = normalizeProgressDate(date);
  if (!normalized) throw new Error(`进度日期无效：${date}`);

  const [year = '', month = '', day = ''] = normalized.split('-');
  return path.join(`${year.slice(-2)}-${month}`, `${day}.md`);
};

export const getProgressFilePath = (date: string): string =>
  path.join(getProgressRoot(), getProgressRelativePath(date));

const parseProgressSource = (source: string, date: string): ProgressTask[] => {
  const tasks: ProgressTask[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line) => {
    const match = PROGRESS_TASK_RE.exec(line);
    const text = match?.[2]?.trim() ?? '';
    if (!match || !text) return;

    tasks.push({
      id: `${date}:${tasks.length}`,
      text,
      completed: Boolean(match[1])
    });
  });

  return tasks;
};

const readProgressSource = async (date: string): Promise<{ exists: boolean; source: string }> => {
  const filePath = getProgressFilePath(date);
  try {
    return { exists: true, source: await readFile(filePath, 'utf8') };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return { exists: false, source: '' };
    throw error;
  }
};

export const readProgressDay = async (date: string): Promise<ProgressDay> => {
  const normalizedDate = normalizeProgressDate(date);
  if (!normalizedDate) throw new Error(`进度日期无效：${date}`);

  const { exists, source } = await readProgressSource(normalizedDate);
  return {
    date: normalizedDate,
    exists,
    tasks: parseProgressSource(source, normalizedDate)
  };
};

const serializeTaskLine = (text: string, completed: boolean): string =>
  `[${completed ? 'x' : ''}] ${text}`;

const validateTaskText = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error('任务内容不能为空');
  if (normalized.length > MAX_TASK_LENGTH) {
    throw new Error(`任务内容不能超过 ${MAX_TASK_LENGTH} 个字符`);
  }
  return normalized;
};

const assertTaskIndex = (taskIndex: number): void => {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    throw new Error('任务序号无效');
  }
};

const mapTaskLines = (
  source: string,
  taskIndex: number,
  errorLabel: string,
  mapLine: (text: string, completed: boolean) => string | null
): string => {
  const lines = source.split(/\r?\n/);
  let currentTaskIndex = 0;
  let replaced = false;

  const nextLines = lines.map((line) => {
    const match = PROGRESS_TASK_RE.exec(line);
    const text = match?.[2]?.trim() ?? '';
    if (!match || !text) return line;
    const index = currentTaskIndex;
    currentTaskIndex += 1;
    if (index !== taskIndex) return line;

    replaced = true;
    const nextLine = mapLine(text, Boolean(match[1]));
    return nextLine ?? line;
  });

  if (!replaced) throw new Error(`找不到要${errorLabel}的进度任务`);
  return nextLines.filter((line) => line.trim().length > 0).join('\n');
};

const replaceTaskLine = (source: string, taskIndex: number): string =>
  mapTaskLines(source, taskIndex, '切换', (_text, completed) => serializeTaskLine(_text, !completed));

const updateTaskLine = (source: string, taskIndex: number, text: string): string =>
  mapTaskLines(source, taskIndex, '编辑', (_text, completed) => serializeTaskLine(text, completed));

const removeTaskLine = (source: string, taskIndex: number): string =>
  mapTaskLines(source, taskIndex, '删除', () => '');

const appendTaskLine = (source: string, text: string, completed = false): string => {
  const normalized = validateTaskText(text);
  const prefix = source.length > 0 && !source.endsWith('\n') ? `${source}\n` : source;
  return `${prefix}${serializeTaskLine(normalized, completed)}\n`;
};

const persistProgressSource = async (date: string, source: string): Promise<void> => {
  const filePath = getProgressFilePath(date);
  await mkdir(path.dirname(filePath), { recursive: true });
  await persistAdminFileTransaction([
    {
      id: 'progress',
      filePath,
      content: source
    }
  ]);
};

export const mutateProgressDay = async (input: ProgressMutation): Promise<ProgressDay> =>
  withAdminContentWriteLock(async () => {
    const normalizedDate = normalizeProgressDate(input.date);
    if (!normalizedDate) throw new Error(`进度日期无效：${input.date}`);
    if (normalizedDate > formatProgressDate(new Date())) {
      throw new Error('不能记录未来的日期');
    }

    const current = await readProgressSource(normalizedDate);
    let nextSource = current.source;

    if (input.action === 'add') {
      nextSource = appendTaskLine(current.source, input.text, input.completed === true);
    } else if (input.action === 'toggle') {
      assertTaskIndex(input.taskIndex);
      nextSource = replaceTaskLine(current.source, input.taskIndex);
    } else if (input.action === 'update') {
      assertTaskIndex(input.taskIndex);
      nextSource = updateTaskLine(current.source, input.taskIndex, validateTaskText(input.text));
    } else {
      assertTaskIndex(input.taskIndex);
      nextSource = removeTaskLine(current.source, input.taskIndex);
    }

    const nextTasks = parseProgressSource(nextSource, normalizedDate);
    if (nextTasks.length === 0) {
      if (current.exists) {
        await rm(getProgressFilePath(normalizedDate), { force: true });
      }
    } else if (nextSource !== current.source) {
      await persistProgressSource(normalizedDate, nextSource);
    }

    return readProgressDay(normalizedDate);
  });

export const getProgressState = async (): Promise<ProgressState> => {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>([currentYear]);
  const days: Record<string, ProgressTask[]> = {};
  const root = getProgressRoot();

  let monthEntries;
  try {
    monthEntries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { years: [currentYear], days };
    }
    throw error;
  }

  for (const monthEntry of monthEntries) {
    if (!monthEntry.isDirectory()) continue;
    const month = parseProgressMonth(monthEntry.name);
    if (!month) continue;
    years.add(month.year);

    let dayEntries;
    try {
      dayEntries = await readdir(path.join(root, monthEntry.name), { withFileTypes: true });
    } catch {
      continue;
    }

    for (const dayEntry of dayEntries) {
      if (!dayEntry.isFile()) continue;
      const match = PROGRESS_DAY_FILE_RE.exec(dayEntry.name);
      if (!match) continue;

      const day = Number(match[1]);
      if (!isValidCalendarDate(month.year, month.month, day)) continue;
      const date = `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const source = await readFile(path.join(root, monthEntry.name, dayEntry.name), 'utf8');
      days[date] = parseProgressSource(source, date);
    }
  }

  return {
    years: Array.from(years).sort((a, b) => a - b),
    days
  };
};
