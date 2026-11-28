// 新建应用表单的校验规则：纯函数，两端共用同一套文案与判定
import {
  APP_CATEGORIES,
  APP_STATUSES,
  type AppCategory,
  type AppInput,
  type AppStatus,
} from './apps';

export interface AppDraft {
  name: string;
  owner: string;
  category: string;
  status: string;
}

export type AppDraftErrors = Partial<Record<keyof AppDraft, string>>;

export const NAME_MIN = 2;
export const NAME_MAX = 20;
export const OWNER_MAX = 10;

export const DRAFT_ERROR_TEXT = {
  nameRequired: '应用名不能为空',
  nameTooShort: `应用名至少 ${NAME_MIN} 个字`,
  nameTooLong: `应用名最多 ${NAME_MAX} 个字符`,
  nameDuplicated: '应用名已存在，换一个',
  ownerRequired: '负责人不能为空',
  ownerTooLong: `负责人最多 ${OWNER_MAX} 个字`,
  categoryInvalid: '请选择应用分类',
  statusInvalid: '请选择应用状态',
} as const;

export function createEmptyDraft(): AppDraft {
  return { name: '', owner: '', category: '', status: '' };
}

export function isDraftEmpty(draft: AppDraft): boolean {
  return draft.name.trim() === '' && draft.owner.trim() === '';
}

/** 名称比对忽略首尾空格与大小写，避免「交易中台」和「交易中台 」被当成两个 */
function isDuplicatedName(name: string, existingNames: readonly string[]): boolean {
  const normalized = name.trim().toLowerCase();
  return existingNames.some((item) => item.trim().toLowerCase() === normalized);
}

export function validateAppDraft(
  draft: AppDraft,
  existingNames: readonly string[] = [],
): AppDraftErrors {
  const errors: AppDraftErrors = {};
  const name = draft.name.trim();
  const owner = draft.owner.trim();

  if (name === '') {
    errors.name = DRAFT_ERROR_TEXT.nameRequired;
  } else if (name.length < NAME_MIN) {
    errors.name = DRAFT_ERROR_TEXT.nameTooShort;
  } else if (name.length > NAME_MAX) {
    errors.name = DRAFT_ERROR_TEXT.nameTooLong;
  } else if (isDuplicatedName(name, existingNames)) {
    errors.name = DRAFT_ERROR_TEXT.nameDuplicated;
  }

  if (owner === '') {
    errors.owner = DRAFT_ERROR_TEXT.ownerRequired;
  } else if (owner.length > OWNER_MAX) {
    errors.owner = DRAFT_ERROR_TEXT.ownerTooLong;
  }

  if (!APP_CATEGORIES.includes(draft.category as AppCategory)) {
    errors.category = DRAFT_ERROR_TEXT.categoryInvalid;
  }

  if (!APP_STATUSES.includes(draft.status as AppStatus)) {
    errors.status = DRAFT_ERROR_TEXT.statusInvalid;
  }

  return errors;
}

export function isDraftValid(errors: AppDraftErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** 校验通过后转成领域输入；这里再做一次类型收窄，页面不需要重复 as */
export function toAppInput(draft: AppDraft): AppInput {
  return {
    name: draft.name.trim(),
    owner: draft.owner.trim(),
    category: draft.category as AppCategory,
    status: draft.status as AppStatus,
  };
}
