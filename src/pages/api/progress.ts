import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../lib/admin-console/admin-api';
import {
  getProgressState,
  mutateProgressDay,
  normalizeProgressDate,
  readProgressDay,
  type ProgressMutation
} from '../../lib/progress';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: ADMIN_JSON_HEADERS
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '进度文件操作失败';

const assertDevRoute = (): Response | null =>
  import.meta.env.DEV || process.env.VITEST ? null : DEV_ONLY_NOT_FOUND_RESPONSE.clone();

export const GET: APIRoute = async ({ url }) => {
  const unavailable = assertDevRoute();
  if (unavailable) return unavailable;

  const rawDate = url.searchParams.get('date')?.trim();
  if (rawDate) {
    const date = normalizeProgressDate(rawDate);
    if (!date) return json({ ok: false, errors: ['日期格式必须是 YYYY-MM-DD'] }, 400);

    try {
      return json({ ok: true, day: await readProgressDay(date) });
    } catch (error) {
      return json({ ok: false, errors: [getErrorMessage(error)] }, 400);
    }
  }

  try {
    return json({ ok: true, state: await getProgressState() });
  } catch (error) {
    console.error('[astro-whono] Failed to read progress state:', error);
    return json({ ok: false, errors: ['读取进度文件失败'] }, 500);
  }
};

const parseMutation = (body: unknown): ProgressMutation | null => {
  if (!isRecord(body) || typeof body.action !== 'string' || typeof body.date !== 'string') return null;

  if (body.action === 'add' && typeof body.text === 'string') {
    return {
      action: 'add',
      date: body.date,
      text: body.text,
      ...(typeof body.completed === 'boolean' ? { completed: body.completed } : {})
    };
  }
  if ((body.action === 'toggle' || body.action === 'remove') && typeof body.taskIndex === 'number') {
    return { action: body.action, date: body.date, taskIndex: body.taskIndex };
  }
  if (body.action === 'update' && typeof body.taskIndex === 'number' && typeof body.text === 'string') {
    return { action: 'update', date: body.date, taskIndex: body.taskIndex, text: body.text };
  }
  return null;
};

export const POST: APIRoute = async ({ request, url }) => {
  const unavailable = assertDevRoute();
  if (unavailable) return unavailable;

  const requestError = validateAdminJsonWriteRequest(request, url, 'progress');
  if (requestError) return json({ ok: false, errors: [requestError.error] }, requestError.status);

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认已发送 JSON 字符串'
  });
  if (!bodyResult.ok) return json({ ok: false, errors: [bodyResult.error] }, bodyResult.status);

  const mutation = parseMutation(bodyResult.body);
  if (!mutation) return json({ ok: false, errors: ['无效的进度操作'] }, 400);

  try {
    return json({ ok: true, day: await mutateProgressDay(mutation) });
  } catch (error) {
    return json({ ok: false, errors: [getErrorMessage(error)] }, 400);
  }
};
