import { describe, expect, it } from 'vitest';
import {
  DRAFT_ERROR_TEXT,
  NAME_MAX,
  NAME_MIN,
  OWNER_MAX,
  createEmptyDraft,
  isDraftEmpty,
  isDraftValid,
  toAppInput,
  validateAppDraft,
  type AppDraft,
} from './';

const validDraft: AppDraft = {
  name: '会员中心',
  owner: '张三',
  category: '营销',
  status: 'online',
};

describe('createEmptyDraft', () => {
  it('四个字段都是空串', () => {
    expect(createEmptyDraft()).toEqual({ name: '', owner: '', category: '', status: '' });
  });

  it('空草稿被识别为未填写', () => {
    expect(isDraftEmpty(createEmptyDraft())).toBe(true);
  });
});

describe('validateAppDraft', () => {
  it('完整合法的草稿没有错误', () => {
    expect(validateAppDraft(validDraft)).toEqual({});
    expect(isDraftValid(validateAppDraft(validDraft))).toBe(true);
  });

  it('应用名必填', () => {
    expect(validateAppDraft({ ...validDraft, name: '   ' }).name).toBe(
      DRAFT_ERROR_TEXT.nameRequired,
    );
  });

  it('应用名太短', () => {
    expect(validateAppDraft({ ...validDraft, name: 'a' }).name).toBe(DRAFT_ERROR_TEXT.nameTooShort);
  });

  it(`应用名恰好 ${NAME_MIN} 个字算合法`, () => {
    expect(validateAppDraft({ ...validDraft, name: '应用' }).name).toBeUndefined();
  });

  it('应用名太长', () => {
    const longName = '应'.repeat(NAME_MAX + 1);
    expect(validateAppDraft({ ...validDraft, name: longName }).name).toBe(
      DRAFT_ERROR_TEXT.nameTooLong,
    );
  });

  it(`应用名恰好 ${NAME_MAX} 个字符算合法`, () => {
    expect(validateAppDraft({ ...validDraft, name: '应'.repeat(NAME_MAX) }).name).toBeUndefined();
  });

  it('重名被拦下', () => {
    expect(validateAppDraft({ ...validDraft, name: '交易中台' }, ['交易中台']).name).toBe(
      DRAFT_ERROR_TEXT.nameDuplicated,
    );
  });

  it('重名比对忽略首尾空格和大小写', () => {
    expect(validateAppDraft({ ...validDraft, name: '  TradeCore  ' }, ['tradecore']).name).toBe(
      DRAFT_ERROR_TEXT.nameDuplicated,
    );
  });

  it('负责人必填', () => {
    expect(validateAppDraft({ ...validDraft, owner: ' ' }).owner).toBe(
      DRAFT_ERROR_TEXT.ownerRequired,
    );
  });

  it('负责人太长', () => {
    expect(validateAppDraft({ ...validDraft, owner: '名'.repeat(OWNER_MAX + 1) }).owner).toBe(
      DRAFT_ERROR_TEXT.ownerTooLong,
    );
  });

  it(`负责人恰好 ${OWNER_MAX} 个字算合法`, () => {
    expect(
      validateAppDraft({ ...validDraft, owner: '名'.repeat(OWNER_MAX) }).owner,
    ).toBeUndefined();
  });

  it('分类非法', () => {
    expect(validateAppDraft({ ...validDraft, category: '金融' }).category).toBe(
      DRAFT_ERROR_TEXT.categoryInvalid,
    );
  });

  it('状态非法', () => {
    expect(validateAppDraft({ ...validDraft, status: 'paused' }).status).toBe(
      DRAFT_ERROR_TEXT.statusInvalid,
    );
  });

  it('全空草稿会一次报四条错误', () => {
    const errors = validateAppDraft(createEmptyDraft());
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'owner', 'status']);
    expect(isDraftValid(errors)).toBe(false);
  });
});

describe('toAppInput', () => {
  it('去掉首尾空格并保留领域类型', () => {
    expect(toAppInput({ ...validDraft, name: ' 会员中心 ', owner: ' 张三 ' })).toEqual({
      name: '会员中心',
      owner: '张三',
      category: '营销',
      status: 'online',
    });
  });
});
