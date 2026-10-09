import { parseProgressTaskText } from '../lib/progress-links';

type ProgressTask = {
  text: string;
  completed: boolean;
};

type ProgressState = {
  years: number[];
  days: Record<string, ProgressTask[]>;
};

type ProgressRoot = HTMLElement & {
  __progressInitialized?: boolean;
};

type FocusTarget =
  | { type: 'task'; index: number }
  | { type: 'new' }
  | null;

const stateScriptId = 'progress-heatmap-state';

const getRoot = (): ProgressRoot | null => document.querySelector<ProgressRoot>('[data-progress-heatmap]');

const getState = (root: HTMLElement): ProgressState => {
  const script = root.querySelector<HTMLScriptElement>(`#${stateScriptId}`);
  if (!script?.textContent) return { years: [new Date().getFullYear()], days: {} };
  try {
    const value = JSON.parse(script.textContent) as ProgressState;
    return {
      years: Array.isArray(value.years) ? value.years : [new Date().getFullYear()],
      days: value.days && typeof value.days === 'object' ? value.days : {}
    };
  } catch {
    return { years: [new Date().getFullYear()], days: {} };
  }
};

const pad = (value: number): string => String(value).padStart(2, '0');

const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const getDaysInYear = (year: number): string[] => {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const days: string[] = [];
  for (const date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
    days.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return days;
};

const getWeeks = (year: number): string[][] => {
  const weeks: string[][] = [];
  let week: string[] = [];
  for (let index = 0; index < new Date(year, 0, 1).getDay(); index += 1) week.push('');
  for (const date of getDaysInYear(year)) {
    week.push(date);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push('');
    weeks.push(week);
  }
  return weeks;
};

const getLevel = (tasks: ProgressTask[] | undefined): number => {
  if (!tasks || tasks.length === 0) return 0;
  return Math.min(4, tasks.length);
};

const formatDateLabel = (date: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date(`${date}T00:00:00`));

const formatWeekMonthLabel = (weeks: string[][], index: number): string => {
  const firstDate = weeks[index]?.find(Boolean);
  if (!firstDate || new Date(`${firstDate}T00:00:00`).getDate() > 7) return '';
  const previousDate = weeks[index - 1]?.find(Boolean);
  if (previousDate && previousDate.slice(0, 7) === firstDate.slice(0, 7)) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short' })
    .format(new Date(`${firstDate}T00:00:00`));
};

const normalizeTaskText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const setStatus = (root: HTMLElement, message: string, isError = false): void => {
  const status = root.querySelector<HTMLElement>('[data-progress-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ready';
};

const renderYears = (root: HTMLElement, state: ProgressState, selectedYear: number): void => {
  const host = root.querySelector<HTMLElement>('[data-progress-years]');
  if (!host) return;
  host.replaceChildren(...state.years.map((year) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `progress-heatmap__year${year === selectedYear ? ' is-active' : ''}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(year === selectedYear));
    button.dataset.progressYear = String(year);
    button.textContent = String(year);
    return button;
  }));
};

const renderCalendar = (root: HTMLElement, state: ProgressState, year: number): void => {
  const monthHost = root.querySelector<HTMLElement>('[data-progress-months]');
  const grid = root.querySelector<HTMLElement>('[data-progress-grid]');
  if (!monthHost || !grid) return;
  const weeks = getWeeks(year);
  const today = getTodayString();

  monthHost.replaceChildren(...weeks.map((_week, index) => {
    const label = document.createElement('span');
    label.style.gridColumn = String(index + 1);
    label.textContent = formatWeekMonthLabel(weeks, index);
    return label;
  }));

  grid.setAttribute('aria-label', `${year} 年每日进度`);
  grid.replaceChildren(...weeks.map((week) => {
    const weekElement = document.createElement('div');
    weekElement.className = 'progress-heatmap__week';
    weekElement.setAttribute('role', 'row');
    weekElement.replaceChildren(...week.map((date) => {
      if (!date) {
        const empty = document.createElement('span');
        empty.className = 'progress-heatmap__day is-empty';
        empty.setAttribute('aria-hidden', 'true');
        return empty;
      }
      if (date > today) {
        const future = document.createElement('span');
        future.className = 'progress-heatmap__day is-future';
        future.setAttribute('aria-hidden', 'true');
        return future;
      }
      const tasks = state.days[date];
      if (date < today && (!tasks || tasks.length === 0)) {
        const disabled = document.createElement('span');
        disabled.className = 'progress-heatmap__day is-disabled';
        disabled.setAttribute('aria-hidden', 'true');
        return disabled;
      }
      const day = document.createElement('button');
      day.type = 'button';
      day.className = `progress-heatmap__day is-level-${getLevel(tasks)}`;
      if (date === today) {
        day.classList.add('is-today');
      }
      day.dataset.progressDate = date;
      day.dataset.progressLevel = String(getLevel(tasks));
      day.setAttribute('role', 'gridcell');
      day.setAttribute('aria-label', `${formatDateLabel(date)}，${tasks && tasks.length > 0 ? `${tasks.length} 项任务` : '尚未记录'}`);
      day.title = formatDateLabel(date);
      return day;
    }));
    return weekElement;
  }));
};

const buildTaskRow = (task: ProgressTask, index: number, editable = true): HTMLElement => {
  const row = document.createElement('div');
  row.className = `progress-heatmap__task${task.completed ? ' is-complete' : ''}`;
  row.dataset.progressTaskRow = '';
  row.dataset.progressTaskIndex = String(index);

  if (editable) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'progress-heatmap__task-toggle';
    toggle.dataset.progressToggle = String(index);
    toggle.title = task.completed ? '标记为未完成' : '标记为完成';
    toggle.setAttribute('aria-label', task.completed ? `标记任务未完成：${task.text}` : `完成任务：${task.text}`);
    const circle = document.createElement('span');
    circle.setAttribute('aria-hidden', 'true');
    toggle.append(circle);
    row.append(toggle);
  } else {
    const marker = document.createElement('span');
    marker.className = 'progress-heatmap__task-toggle';
    marker.setAttribute('aria-hidden', 'true');
    const circle = document.createElement('span');
    circle.setAttribute('aria-hidden', 'true');
    marker.append(circle);
    row.append(marker);
  }

  const body = document.createElement('span');
  body.className = 'progress-heatmap__task-body';
  const text = document.createElement('span');
  text.className = 'progress-heatmap__task-text';
  if (editable) {
    text.textContent = task.text;
  } else {
    for (const part of parseProgressTaskText(task.text)) {
      if (part.type === 'link') {
        const link = document.createElement('a');
        link.href = part.href;
        link.textContent = part.value;
        text.append(link);
      } else {
        text.append(document.createTextNode(part.value));
      }
    }
  }
  if (editable) {
    text.setAttribute('contenteditable', 'plaintext-only');
    text.setAttribute('role', 'textbox');
    text.setAttribute('aria-multiline', 'false');
    text.setAttribute('aria-label', '编辑任务，回车保存');
    text.dataset.progressTaskText = String(index);
    text.dataset.progressCommitted = task.text;
  }
  body.append(text);

  row.append(body);
  return row;
};

const buildNewRow = (): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'progress-heatmap__task is-new';
  row.dataset.progressNewRow = '';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'progress-heatmap__task-toggle progress-heatmap__task-new-toggle';
  toggle.dataset.progressNewToggle = '';
  toggle.setAttribute('aria-label', '输入任务后标记为完成');
  toggle.title = '输入任务后标记为完成';
  const circle = document.createElement('span');
  circle.setAttribute('aria-hidden', 'true');
  toggle.append(circle);

  const body = document.createElement('span');
  body.className = 'progress-heatmap__task-body';
  const input = document.createElement('span');
  input.className = 'progress-heatmap__task-text';
  input.setAttribute('contenteditable', 'plaintext-only');
  input.setAttribute('role', 'textbox');
  input.setAttribute('aria-multiline', 'false');
  input.setAttribute('aria-label', '添加任务，回车保存');
  input.dataset.progressNewInput = '';
  const line = document.createElement('span');
  line.className = 'progress-heatmap__task-ghost-line';
  line.setAttribute('aria-hidden', 'true');
  body.append(input, line);

  row.append(toggle, body);
  return row;
};

const syncNewRowState = (input: HTMLElement): void => {
  const row = input.closest<HTMLElement>('[data-progress-new-row]');
  const toggle = row?.querySelector<HTMLButtonElement>('[data-progress-new-toggle]');
  if (!row || !toggle) return;
  const hasText = normalizeTaskText(input.textContent ?? '').length > 0;
  row.classList.toggle('is-typed', hasText);
  toggle.setAttribute('aria-label', hasText ? '标记新任务为完成' : '输入任务后标记为完成');
  toggle.title = hasText ? '标记新任务为完成' : '输入任务后标记为完成';
};

const placeCaretEnd = (element: HTMLElement): void => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const renderTasks = (root: HTMLElement, state: ProgressState, date: string, focus: FocusTarget = null): void => {
  const tasks = state.days[date] ?? [];
  const label = root.querySelector<HTMLElement>('[data-progress-date-label]');
  const count = root.querySelector<HTMLElement>('[data-progress-task-count]');
  const list = root.querySelector<HTMLElement>('[data-progress-task-list]');
  if (label) label.textContent = formatDateLabel(date);
  if (count) count.textContent = `${tasks.length} 项`;
  if (!list) return;

  // 没有显式焦点目标时，还原重新渲染前正在编辑的行
  let restore: FocusTarget = focus;
  const active = document.activeElement;
  if (!restore && active instanceof HTMLElement && list.contains(active)) {
    if (active.dataset.progressNewInput !== undefined) {
      restore = { type: 'new' };
    } else if (active.dataset.progressTaskText !== undefined) {
      restore = { type: 'task', index: Number(active.dataset.progressTaskText) };
    }
  }

  const editable = root.dataset.progressEditable === 'true';
  const rows = tasks.map((task, index) => buildTaskRow(task, index, editable));
  if (editable && canEditDate(date, state)) rows.push(buildNewRow());
  list.replaceChildren(...rows);

  if (restore?.type === 'task') {
    const target = list.querySelector<HTMLElement>(`[data-progress-task-text="${restore.index}"]`)
      ?? list.querySelector<HTMLElement>('[data-progress-new-input]');
    if (target) {
      target.focus();
      placeCaretEnd(target);
    }
  } else if (restore?.type === 'new') {
    list.querySelector<HTMLElement>('[data-progress-new-input]')?.focus();
  }
};

const getSelectedDate = (root: HTMLElement): string =>
  root.dataset.selectedDate ?? getTodayString();

const canEditDate = (date: string, state: ProgressState): boolean =>
  date === getTodayString() || (state.days[date]?.length ?? 0) > 0;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '保存进度失败';

export const initProgressHeatmap = (): void => {
  const root = getRoot();
  if (!root || root.__progressInitialized) return;
  root.__progressInitialized = true;
  const state = getState(root);
  let selectedYear = Number(root.dataset.selectedYear) || new Date().getFullYear();
  const pendingMutations = new WeakSet<HTMLElement>();

  const postMutation = async (mutation: Record<string, unknown>): Promise<ProgressTask[]> => {
    const response = await fetch(root.dataset.apiUrl ?? '/api/progress/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mutation)
    });
    const payload = await response.json() as { ok?: boolean; day?: { date: string; tasks: ProgressTask[] }; errors?: string[] };
    if (!response.ok || !payload.ok || !payload.day) {
      throw new Error(payload.errors?.[0] ?? '保存进度失败');
    }
    return payload.day.tasks;
  };

  const runMutation = async (mutation: Record<string, unknown>): Promise<ProgressTask[]> => {
    const tasks = await postMutation(mutation);
    state.days[mutation.date as string] = tasks;
    renderCalendar(root, state, selectedYear);
    return tasks;
  };

  const updateTaskCount = (date: string, count: number): void => {
    const element = root.querySelector<HTMLElement>('[data-progress-task-count]');
    if (element && getSelectedDate(root) === date) element.textContent = `${count} 项`;
  };

  const reindexRows = (): void => {
    root.querySelectorAll<HTMLElement>('[data-progress-task-row]').forEach((row, index) => {
      row.dataset.progressTaskIndex = String(index);
      const toggle = row.querySelector<HTMLElement>('[data-progress-toggle]');
      if (toggle) toggle.dataset.progressToggle = String(index);
      const text = row.querySelector<HTMLElement>('[data-progress-task-text]');
      if (text) text.dataset.progressTaskText = String(index);
    });
  };

  const removeTaskRowInPlace = (date: string, taskIndex: number): void => {
    root.querySelector<HTMLElement>(`[data-progress-task-index="${taskIndex}"]`)?.remove();
    reindexRows();
    updateTaskCount(date, (state.days[date] ?? []).length);
  };

  const appendTaskRowInPlace = (date: string, task: ProgressTask): void => {
    const newRow = root.querySelector<HTMLElement>('[data-progress-new-row]');
    const list = root.querySelector<HTMLElement>('[data-progress-task-list]');
    if (!newRow || !list) return;
    newRow.before(buildTaskRow(task, (state.days[date] ?? []).length - 1));
    reindexRows();
    updateTaskCount(date, (state.days[date] ?? []).length);
  };

  const commitEdit = async (element: HTMLElement): Promise<void> => {
    if (pendingMutations.has(element)) return;
    const date = getSelectedDate(root);
    const tasks = state.days[date] ?? [];
    const taskIndex = Number(element.dataset.progressTaskText);
    if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) return;

    const committed = element.dataset.progressCommitted ?? tasks[taskIndex]?.text ?? '';
    const text = normalizeTaskText(element.textContent ?? '');
    if (text === committed) {
      return;
    }

    pendingMutations.add(element);
    element.dataset.progressCommitted = text;
    try {
      if (!text) {
        await runMutation({ action: 'remove', date, taskIndex });
        setStatus(root, '');
        if (getSelectedDate(root) === date) removeTaskRowInPlace(date, taskIndex);
        return;
      }
      await runMutation({ action: 'update', date, taskIndex, text });
      setStatus(root, '');
    } catch (error) {
      element.dataset.progressCommitted = committed;
      setStatus(root, getErrorMessage(error), true);
    } finally {
      pendingMutations.delete(element);
    }
  };

  const commitActiveEdit = (): void => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return;
    if (active.dataset.progressTaskText === undefined) return;
    void commitEdit(active);
  };

  const commitNewTask = async (input: HTMLElement, completed = false): Promise<void> => {
    if (pendingMutations.has(input)) return;
    const date = getSelectedDate(root);
    const text = normalizeTaskText(input.textContent ?? '');
    if (!text) return;

    pendingMutations.add(input);
    try {
      const tasks = await runMutation({ action: 'add', date, text, completed });
      setStatus(root, '');
      if (getSelectedDate(root) === date) {
        const lastTask = tasks.at(-1);
        if (lastTask) appendTaskRowInPlace(date, lastTask);
        input.textContent = '';
        syncNewRowState(input);
        input.focus();
      }
    } catch (error) {
      setStatus(root, getErrorMessage(error), true);
    } finally {
      pendingMutations.delete(input);
    }
  };

  const commitEditAndAdvance = async (element: HTMLElement): Promise<void> => {
    if (pendingMutations.has(element)) return;
    const date = getSelectedDate(root);
    const tasks = state.days[date] ?? [];
    const taskIndex = Number(element.dataset.progressTaskText);
    if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) return;

    const committed = element.dataset.progressCommitted ?? tasks[taskIndex]?.text ?? '';
    const text = normalizeTaskText(element.textContent ?? '');

    if (!text) {
      if (text === committed) return;
      pendingMutations.add(element);
      element.dataset.progressCommitted = '';
      try {
        await runMutation({ action: 'remove', date, taskIndex });
        setStatus(root, '');
        if (getSelectedDate(root) === date) {
          removeTaskRowInPlace(date, taskIndex);
          const next = root.querySelector<HTMLElement>(`[data-progress-task-text="${taskIndex}"]`)
            ?? root.querySelector<HTMLElement>('[data-progress-new-input]');
          if (next) next.focus();
        }
      } catch (error) {
        element.dataset.progressCommitted = committed;
        setStatus(root, getErrorMessage(error), true);
      } finally {
        pendingMutations.delete(element);
      }
      return;
    }

    if (text !== committed) {
      pendingMutations.add(element);
      element.dataset.progressCommitted = text;
      try {
        await runMutation({ action: 'update', date, taskIndex, text });
        setStatus(root, '');
      } catch (error) {
        element.dataset.progressCommitted = committed;
        setStatus(root, getErrorMessage(error), true);
        return;
      } finally {
        pendingMutations.delete(element);
      }
    }

    if (getSelectedDate(root) !== date) return;
    const nextTarget = root.querySelector<HTMLElement>(`[data-progress-task-text="${taskIndex + 1}"]`);
    if (nextTarget) {
      nextTarget.focus();
      placeCaretEnd(nextTarget);
      return;
    }
    root.querySelector<HTMLElement>('[data-progress-new-input]')?.focus();
  };

  const selectDate = (date: string): void => {
    commitActiveEdit();
    root.dataset.selectedDate = date;
    root.querySelectorAll<HTMLElement>('[data-progress-date]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.progressDate === date);
    });
    renderTasks(root, state, date);
  };

  const refreshYear = (year: number): void => {
    selectedYear = year;
    root.dataset.selectedYear = String(year);
    renderYears(root, state, year);
    renderCalendar(root, state, year);
    const selectedDate = getSelectedDate(root);
    const selectedDateYear = Number(selectedDate.slice(0, 4));
    selectDate(selectedDateYear === year ? selectedDate : `${year}-01-01`);
  };

  root.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const yearButton = target.closest<HTMLButtonElement>('[data-progress-year]');
    if (yearButton) {
      refreshYear(Number(yearButton.dataset.progressYear));
      return;
    }

    const dayButton = target.closest<HTMLButtonElement>('[data-progress-date]');
    if (dayButton?.dataset.progressDate) {
      selectDate(dayButton.dataset.progressDate);
      return;
    }

    const toggleButton = target.closest<HTMLButtonElement>('[data-progress-toggle]');
    if (toggleButton) {
      const date = getSelectedDate(root);
      const row = toggleButton.closest<HTMLElement>('[data-progress-task-row]');
      const taskIndex = Number(row?.dataset.progressTaskIndex);
      try {
        const tasks = await runMutation({ action: 'toggle', date, taskIndex });
        setStatus(root, '');
        if (getSelectedDate(root) === date) {
          const task = tasks[taskIndex];
          if (task && row) {
            row.classList.toggle('is-complete', task.completed);
            toggleButton.title = task.completed ? '标记为未完成' : '标记为完成';
            toggleButton.setAttribute('aria-label', task.completed ? `标记任务未完成：${task.text}` : `完成任务：${task.text}`);
          }
          updateTaskCount(date, tasks.length);
        }
      } catch (error) {
        setStatus(root, getErrorMessage(error), true);
      }
      return;
    }

    const newToggle = target.closest<HTMLButtonElement>('[data-progress-new-toggle]');
    if (newToggle) {
      const input = newToggle.closest<HTMLElement>('[data-progress-new-row]')
        ?.querySelector<HTMLElement>('[data-progress-new-input]');
      if (input) {
        if (normalizeTaskText(input.textContent ?? '')) {
          void commitNewTask(input, true);
        } else {
          input.focus();
        }
      }
    }
  });

  root.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const isNewInput = target.dataset.progressNewInput !== undefined;
    const isTaskText = target.dataset.progressTaskText !== undefined;
    if (!isTaskText && !isNewInput) return;

    if (event.isComposing) return;

    if (event.key === 'Escape') {
      const committed = target.dataset.progressCommitted ?? '';
      if (normalizeTaskText(target.textContent ?? '') !== committed) {
        target.textContent = committed;
        placeCaretEnd(target);
        if (isNewInput) {
          syncNewRowState(target);
        }
      }
      event.preventDefault();
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (isNewInput) {
      void commitNewTask(target);
      return;
    }
    void commitEditAndAdvance(target);
  });

  root.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.progressNewInput !== undefined) {
      syncNewRowState(target);
    }
  });

  root.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.progressTaskText === undefined) return;
    void commitEdit(target);
  });

  selectDate(getSelectedDate(root));
};
