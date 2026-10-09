import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getProgressState,
  mutateProgressDay
} from '../src/lib/progress';

let tempRoot = '';

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'progress-'));
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
});

afterAll(async () => {
  delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe('progress day mutations', () => {
  it('adds, toggles, updates and removes tasks in order', async () => {
    const date = '2026-01-02';

    let day = await mutateProgressDay({ action: 'add', date, text: ' 写第一篇周记 ' });
    expect(day.tasks).toEqual([{ id: `${date}:0`, text: '写第一篇周记', completed: false }]);

    day = await mutateProgressDay({ action: 'add', date, text: '跑步' });
    expect(day.tasks.map((task) => task.text)).toEqual(['写第一篇周记', '跑步']);

    day = await mutateProgressDay({ action: 'toggle', date, taskIndex: 0 });
    expect(day.tasks[0]).toMatchObject({ text: '写第一篇周记', completed: true });

    day = await mutateProgressDay({ action: 'update', date, taskIndex: 1, text: '夜跑 5 公里' });
    expect(day.tasks[1]).toMatchObject({ text: '夜跑 5 公里', completed: false });

    day = await mutateProgressDay({ action: 'remove', date, taskIndex: 0 });
    expect(day.tasks.map((task) => task.text)).toEqual(['夜跑 5 公里']);

    const source = await getProgressState();
    expect(source.days[date]).toHaveLength(1);
  });

  it('can add a task that starts completed', async () => {
    const date = '2026-01-05';
    const day = await mutateProgressDay({ action: 'add', date, text: '已完成任务', completed: true });
    expect(day.tasks).toEqual([
      { id: `${date}:0`, text: '已完成任务', completed: true }
    ]);
  });

  it('deletes the day file when the last task is removed', async () => {
    const date = '2026-01-03';
    await mutateProgressDay({ action: 'add', date, text: '唯一任务' });

    const day = await mutateProgressDay({ action: 'remove', date, taskIndex: 0 });
    expect(day.exists).toBe(false);
    expect(day.tasks).toEqual([]);

    const state = await getProgressState();
    expect(state.days[date]).toBeUndefined();
  });

  it('rejects mutations for future dates', async () => {
    await expect(
      mutateProgressDay({ action: 'add', date: '9999-01-01', text: '未来任务' })
    ).rejects.toThrow('不能记录未来的日期');
  });

  it('rejects empty or oversized task text', async () => {
    const date = '2026-01-04';
    await expect(
      mutateProgressDay({ action: 'add', date, text: '   ' })
    ).rejects.toThrow('任务内容不能为空');
    await expect(
      mutateProgressDay({ action: 'add', date, text: 'a'.repeat(501) })
    ).rejects.toThrow('任务内容不能超过 500 个字符');
  });
});
