import type { SiteSocialIconKey } from '@/lib/theme-settings';
import {
  ADMIN_SOCIAL_CUSTOM_LIMIT,
  normalizeAdminSocialIconKey
} from '@/lib/admin-console/theme-shared';
import type { EditableCustomSocialItem } from './form-codec';

type Query = <T extends Element>(parent: ParentNode, selector: string) => T | null;
type QueryAll = <T extends Element>(parent: ParentNode, selector: string) => T[];

type SocialLinksContext = {
  query: Query;
  queryAll: QueryAll;
  socialCustomList: HTMLElement;
  socialCustomHead: HTMLElement;
  socialCustomCountEl: HTMLElement;
  socialCustomAddBtn: HTMLButtonElement;
  socialCustomTemplate: HTMLTemplateElement;
};

const parseOrder = (value: string | number | null | undefined, fallback: number): number => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : fallback;
};

const parseInteger = (value: string | number | null | undefined): number | null => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : null;
};

const normalizeTrimmed = (value: unknown): string => String(value ?? '').trim();

export const createSocialLinks = ({
  query,
  queryAll,
  socialCustomList,
  socialCustomHead,
  socialCustomCountEl,
  socialCustomAddBtn,
  socialCustomTemplate
}: SocialLinksContext) => {
  const getCustomRows = (): HTMLElement[] => queryAll<HTMLElement>(socialCustomList, '[data-social-custom-row]');

  const fallbackCustomSocialIconKey: SiteSocialIconKey = 'website';
  const customSocialOptionElements = queryAll<HTMLOptionElement>(
    socialCustomTemplate.content,
    '[data-social-custom-field="iconKey"] option'
  );
  const customSocialIconOrder = Array.from(
    new Set(
      customSocialOptionElements.map(
        (option) => normalizeAdminSocialIconKey(option.value) ?? fallbackCustomSocialIconKey
      )
    )
  ) as SiteSocialIconKey[];
  const defaultCustomSocialIconKey: SiteSocialIconKey =
    customSocialIconOrder[0] ?? fallbackCustomSocialIconKey;
  const customSocialIconKeys = new Set<SiteSocialIconKey>(
    customSocialOptionElements.map((option) => {
      return normalizeAdminSocialIconKey(option.value) ?? defaultCustomSocialIconKey;
    })
  );
  const customSocialIconLabels = new Map<SiteSocialIconKey, string>(
    customSocialOptionElements.map((option) => {
      const value = normalizeAdminSocialIconKey(option.value) ?? defaultCustomSocialIconKey;
      const label =
        option.getAttribute('data-social-default-label')?.trim() || option.textContent?.trim() || '链接';
      return [value, label];
    })
  );
  const getDefaultCustomSocialLabel = (iconKey: SiteSocialIconKey): string =>
    customSocialIconLabels.get(iconKey)
    || customSocialIconLabels.get(fallbackCustomSocialIconKey)
    || customSocialIconLabels.get(defaultCustomSocialIconKey)
    || '链接';
  const getCustomFieldTarget = (
    index: number,
    field: 'order' | 'iconKey' | 'id' | 'label' | 'href'
  ) => (): HTMLElement | null => {
    const row = getCustomRows()[index] ?? null;
    return row ? query<HTMLElement>(row, `[data-social-custom-field="${field}"]`) : null;
  };

  const getCustomVisibilityTarget = (index: number): (() => HTMLElement | null) => () => {
    const row = getCustomRows()[index] ?? null;
    return row ? query<HTMLElement>(row, '[data-social-custom-action="toggle-visible"]') : null;
  };

  const getCustomRowIconKey = (row: Element | null): SiteSocialIconKey => {
    const select = row ? query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]') : null;
    const value = normalizeAdminSocialIconKey(select?.value);
    return value && customSocialIconKeys.has(value) ? value : defaultCustomSocialIconKey;
  };

  const getNextDefaultCustomSocialIconKey = (): SiteSocialIconKey => {
    const usedIconKeys = new Set(getCustomRows().map((row) => getCustomRowIconKey(row)));
    return customSocialIconOrder.find((iconKey) => !usedIconKeys.has(iconKey)) || defaultCustomSocialIconKey;
  };

  const getCustomRowLabelInput = (row: Element | null): HTMLInputElement | null =>
    row ? query<HTMLInputElement>(row, '[data-social-custom-field="label"]') : null;

  const getCustomRowLabelField = (row: Element | null): HTMLElement | null =>
    row ? query<HTMLElement>(row, '.admin-social-link-label') : null;

  const normalizeSocialOrders = (): void => {
    type SocialOrderItem = {
      row: HTMLElement;
      visible: boolean;
      order: number;
      tie: number;
    };

    const customRows = getCustomRows();
    const items: SocialOrderItem[] = customRows.map((row, index) => ({
      row,
      visible: Boolean(query<HTMLInputElement>(row, '[data-social-custom-field="visible"]')?.checked),
      order: parseOrder(query<HTMLInputElement>(row, '[data-social-custom-field="order"]')?.value || '', index + 1),
      tie: index
    }));

    const orderedItems = [
      ...items.filter((item) => item.visible).sort((a, b) => a.order - b.order || a.tie - b.tie),
      ...items.filter((item) => !item.visible).sort((a, b) => a.order - b.order || a.tie - b.tie)
    ];

    orderedItems.forEach((item, index) => {
      const orderInput = query<HTMLInputElement>(item.row, '[data-social-custom-field="order"]');
      if (orderInput instanceof HTMLInputElement) orderInput.value = String(index + 1);
    });
  };

  const normalizeCustomSocialLabel = (value: unknown, iconKey: SiteSocialIconKey): string => {
    const normalized = normalizeTrimmed(value);
    return normalized || getDefaultCustomSocialLabel(iconKey);
  };

  const getDisplayCustomSocialLabel = (value: unknown, iconKey: SiteSocialIconKey): string => {
    const normalized = normalizeTrimmed(value);
    return normalized || getDefaultCustomSocialLabel(iconKey);
  };

  const slugifyIdPart = (value: unknown): string => {
    const slug = String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'link';
  };

  const getCustomIdValues = (exceptRow?: Element | null): Set<string> =>
    new Set(
      getCustomRows()
        .filter((row) => row !== exceptRow)
        .map((row) => query<HTMLInputElement>(row, '[data-social-custom-field="id"]')?.value.trim() || '')
        .filter(Boolean)
    );

  const generateCustomId = (
    row: Element | null,
    iconKey: SiteSocialIconKey = getCustomRowIconKey(row)
  ): string => {
    const existingIds = getCustomIdValues(row);
    const base = `custom-${slugifyIdPart(iconKey)}`;
    let candidate = base;
    let suffix = 2;

    while (existingIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  };

  const getStoredGeneratedCustomId = (row: HTMLElement | null): string => row?.dataset.generatedId?.trim() || '';

  const getStoredGeneratedCustomLabel = (row: HTMLElement | null): string =>
    row?.dataset.generatedLabel?.trim() || '';

  const applyGeneratedCustomId = (row: HTMLElement | null, nextId: string): void => {
    const idInput = row ? query<HTMLInputElement>(row, '[data-social-custom-field="id"]') : null;
    if (!(idInput instanceof HTMLInputElement) || !row) return;

    idInput.value = nextId;
    row.dataset.generatedId = nextId;
    row.dataset.idManual = 'false';
  };

  const applyGeneratedCustomLabel = (row: HTMLElement | null, nextLabel: string): void => {
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement) || !row) return;

    labelInput.value = getDisplayCustomSocialLabel(nextLabel, getCustomRowIconKey(row));
    row.dataset.generatedLabel = nextLabel;
    row.dataset.labelManual = 'false';
  };

  const shouldAutoSyncCustomId = (row: HTMLElement | null): boolean => {
    const idInput = row ? query<HTMLInputElement>(row, '[data-social-custom-field="id"]') : null;
    if (!(idInput instanceof HTMLInputElement) || !row) return false;

    const trimmed = idInput.value.trim();
    const generatedId = getStoredGeneratedCustomId(row);
    return row.dataset.idManual !== 'true' || !trimmed || Boolean(generatedId && trimmed === generatedId);
  };

  const shouldAutoSyncCustomLabel = (row: HTMLElement | null): boolean => {
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement) || !row) return false;

    const trimmed = labelInput.value.trim();
    const generatedLabel = getStoredGeneratedCustomLabel(row);
    return row.dataset.labelManual !== 'true' || !trimmed || Boolean(generatedLabel && trimmed === generatedLabel);
  };

  const getNextSocialOrder = (): number => {
    const orders = getCustomRows()
      .map((row) => parseInteger(query<HTMLInputElement>(row, '[data-social-custom-field="order"]')?.value))
      .filter((value): value is number => value != null);
    return orders.length ? Math.max(...orders) + 1 : 1;
  };

  const syncCustomIconPreview = (row: HTMLElement): void => {
    const iconKey = getCustomRowIconKey(row);
    queryAll<HTMLElement>(row, '[data-social-custom-icon-option]').forEach((node) => {
      const active = node.getAttribute('data-social-custom-icon-option') === iconKey;
      node.hidden = !active;
    });
  };

  const syncCustomVisibilityButton = (row: HTMLElement): void => {
    const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');
    const toggleBtn = query<HTMLButtonElement>(row, '[data-social-custom-action="toggle-visible"]');
    const toggleLabel = query<HTMLElement>(row, '[data-social-custom-visible-label]');
    if (
      !(visibleInput instanceof HTMLInputElement) ||
      !(toggleBtn instanceof HTMLButtonElement) ||
      !(toggleLabel instanceof HTMLElement)
    ) {
      return;
    }

    const visible = Boolean(visibleInput.checked);
    toggleBtn.dataset.state = visible ? 'visible' : 'hidden';
    toggleBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', visible ? '隐藏链接' : '显示链接');
    toggleBtn.setAttribute('title', visible ? '隐藏链接' : '显示链接');
    toggleLabel.textContent = visible ? '隐藏链接' : '显示链接';
  };

  const finalizeCustomIdInput = (
    row: HTMLElement,
    options: { regenerateIfEmpty?: boolean } = {}
  ): void => {
    const { regenerateIfEmpty = true } = options;
    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    if (!(idInput instanceof HTMLInputElement)) return;

    const trimmed = idInput.value.trim();
    const generatedId = getStoredGeneratedCustomId(row);
    if (!trimmed && regenerateIfEmpty) {
      applyGeneratedCustomId(row, generateCustomId(row));
    } else {
      idInput.value = trimmed;
      row.dataset.idManual = trimmed && trimmed !== generatedId ? 'true' : 'false';
    }
  };

  const finalizeCustomLabelInput = (
    row: HTMLElement,
    options: { regenerateIfEmpty?: boolean } = {}
  ): void => {
    const { regenerateIfEmpty = true } = options;
    const labelInput = getCustomRowLabelInput(row);
    if (!(labelInput instanceof HTMLInputElement)) return;

    const trimmed = labelInput.value.trim();
    const nextGeneratedLabel = getDefaultCustomSocialLabel(getCustomRowIconKey(row));
    const generatedLabel = getStoredGeneratedCustomLabel(row) || nextGeneratedLabel;
    row.dataset.generatedLabel = nextGeneratedLabel;
    if (!trimmed && regenerateIfEmpty) {
      applyGeneratedCustomLabel(row, nextGeneratedLabel);
    } else {
      labelInput.value = getDisplayCustomSocialLabel(trimmed, getCustomRowIconKey(row));
      row.dataset.labelManual = trimmed && trimmed !== generatedLabel ? 'true' : 'false';
    }
  };

  const syncCustomLabelField = (
    row: HTMLElement,
    options: { syncValue?: boolean } = {}
  ): void => {
    const { syncValue = false } = options;
    const labelField = getCustomRowLabelField(row);
    row.dataset.customLabelVisible = 'true';
    if (labelField instanceof HTMLElement) {
      labelField.hidden = false;
    }

    if (syncValue) {
      const iconKey = getCustomRowIconKey(row);
      const nextGeneratedLabel = getDefaultCustomSocialLabel(iconKey);
      if (shouldAutoSyncCustomLabel(row)) {
        applyGeneratedCustomLabel(row, nextGeneratedLabel);
      } else {
        row.dataset.generatedLabel = nextGeneratedLabel;
      }
    }
  };

  const syncCustomRow = (row: HTMLElement, options: { syncId?: boolean; syncLabel?: boolean } = {}): void => {
    const { syncId = false, syncLabel = false } = options;
    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    if (!(idInput instanceof HTMLInputElement)) return;
    const iconKey = getCustomRowIconKey(row);

    if (syncId && shouldAutoSyncCustomId(row)) {
      applyGeneratedCustomId(row, generateCustomId(row, iconKey));
    }

    syncCustomLabelField(row, { syncValue: syncLabel });
    syncCustomIconPreview(row);
    syncCustomVisibilityButton(row);
  };

  const updateCustomRowsUi = (): void => {
    const rows = getCustomRows();
    socialCustomHead.hidden = false;
    socialCustomCountEl.textContent = `(${rows.length} / ${ADMIN_SOCIAL_CUSTOM_LIMIT})`;
    socialCustomAddBtn.disabled = rows.length >= ADMIN_SOCIAL_CUSTOM_LIMIT;
  };

  const createCustomRow = (
    item: Partial<EditableCustomSocialItem> | null | undefined,
    index: number,
    options: { manualId?: boolean } = {}
  ): HTMLElement | null => {
    const { manualId = false } = options;
    const fragment = socialCustomTemplate.content.cloneNode(true) as DocumentFragment;
    const row = query<HTMLElement>(fragment, '[data-social-custom-row]');
    if (!(row instanceof HTMLElement)) return null;

    const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
    const labelInput = getCustomRowLabelInput(row);
    const hrefInput = query<HTMLInputElement>(row, '[data-social-custom-field="href"]');
    const iconInput = query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]');
    const orderInput = query<HTMLInputElement>(row, '[data-social-custom-field="order"]');
    const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');

    if (
      !(idInput instanceof HTMLInputElement) ||
      !(labelInput instanceof HTMLInputElement) ||
      !(hrefInput instanceof HTMLInputElement) ||
      !(iconInput instanceof HTMLSelectElement) ||
      !(orderInput instanceof HTMLInputElement) ||
      !(visibleInput instanceof HTMLInputElement)
    ) {
      return null;
    }

    row.dataset.idManual = manualId ? 'true' : 'false';
    const initialIconKey =
      typeof item?.iconKey === 'string'
        ? normalizeAdminSocialIconKey(item.iconKey) ?? fallbackCustomSocialIconKey
        : getNextDefaultCustomSocialIconKey();
    const initialLabel = normalizeCustomSocialLabel(item?.label, initialIconKey);
    const initialDisplayLabel = getDisplayCustomSocialLabel(initialLabel, initialIconKey);
    idInput.value = item?.id ? String(item.id).trim() : '';
    labelInput.value = initialDisplayLabel;
    hrefInput.value = item?.href ? String(item.href).trim() : '';
    iconInput.value = initialIconKey;
    orderInput.value = String(parseOrder(item?.order, index + 1));
    visibleInput.checked = item?.visible !== false;
    row.dataset.generatedLabel = getDefaultCustomSocialLabel(initialIconKey);
    row.dataset.labelManual =
      initialDisplayLabel
      && initialLabel !== row.dataset.generatedLabel
        ? 'true'
        : 'false';
    syncCustomRow(row, {
      syncId: !item?.id,
      syncLabel: !item?.label
    });
    row.dataset.generatedId = idInput.value.trim();

    return row;
  };

  const replaceCustomRows = (items: EditableCustomSocialItem[]): void => {
    getCustomRows().forEach((row) => row.remove());
    items.forEach((item, index) => {
      const row = createCustomRow(item, index, { manualId: false });
      if (row) socialCustomList.appendChild(row);
    });
    updateCustomRowsUi();
  };

  return {
    defaultCustomSocialIconKey,
    getCustomRows,
    getCustomFieldTarget,
    getCustomVisibilityTarget,
    getCustomRowLabelInput,
    getStoredGeneratedCustomId,
    getStoredGeneratedCustomLabel,
    getNextSocialOrder,
    getCustomRowIconKey,
    normalizeCustomSocialLabel,
    normalizeSocialOrders,
    syncCustomRow,
    updateCustomRowsUi,
    createCustomRow,
    finalizeCustomIdInput,
    finalizeCustomLabelInput,
    replaceCustomRows
  };
};
