import { useState } from 'react';
import { Alert, Button, Card, Input, Space, Tag } from 'tdesign-react';
import { Link } from 'react-router-dom';
import {
  APP_CATEGORIES,
  APP_STATUSES,
  appListStore,
  createEmptyDraft,
  isDraftValid,
  statusLabel,
  toAppInput,
  validateAppDraft,
  type AppCategory,
  type AppDraft,
  type AppDraftErrors,
  type AppStatus,
} from '@tdesignui/core';

export default function CreatePage() {
  // 校验规则、文案、错误判定全部来自 core，页面只负责把错误贴到对应输入框上
  const [draft, setDraft] = useState<AppDraft>(createEmptyDraft());
  const [errors, setErrors] = useState<AppDraftErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [createdText, setCreatedText] = useState('');

  // 没点过提交就不提前报错，避免一进页面满屏红字
  const shown = attempted ? errors : {};

  const patch = (next: Partial<AppDraft>) => {
    const merged = { ...draft, ...next };
    setDraft(merged);
    setCreatedText('');
    if (attempted) setErrors(validateAppDraft(merged, appListStore.names()));
  };

  const submit = () => {
    const nextErrors = validateAppDraft(draft, appListStore.names());
    setAttempted(true);
    setErrors(nextErrors);
    if (!isDraftValid(nextErrors)) return;

    // 共享单例：写入后列表页订阅会立刻收到新快照
    const item = appListStore.addApp(toAppInput(draft));
    setCreatedText(`已创建「${item.name}」（${item.id}），更新于 ${item.updatedAt}`);
    setDraft(createEmptyDraft());
    setAttempted(false);
    setErrors({});
  };

  const resetForm = () => {
    setDraft(createEmptyDraft());
    setErrors({});
    setAttempted(false);
    setCreatedText('');
  };

  return (
    <div className="tds-page">
      <header className="tds-hero--left">
        <h1>新建应用</h1>
        <p>校验规则与错误文案全部来自 @tdesignui/core，两端共用同一套判定</p>
      </header>

      <div className="tds-stack">
        <Card bordered title="应用信息">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input
              label="应用名"
              value={draft.name}
              placeholder="2-20 个字，不能与已有应用重名"
              clearable
              status={shown.name ? 'error' : 'default'}
              tips={shown.name || '应用名必填，2-20 个字'}
              onChange={(value) => patch({ name: value })}
            />

            <Input
              label="负责人"
              value={draft.owner}
              placeholder="最多 10 个字"
              clearable
              status={shown.owner ? 'error' : 'default'}
              tips={shown.owner || '填写实际负责人，列表页会展示'}
              onChange={(value) => patch({ owner: value })}
            />

            <div className="tds-field">
              <span className="tds-field-label">分类</span>
              <Space align="center" size={8} breakLine>
                {APP_CATEGORIES.map((item) => (
                  <Tag
                    key={item}
                    className="tds-pickable"
                    theme={draft.category === item ? 'primary' : 'default'}
                    variant={draft.category === item ? 'light' : 'outline'}
                    onClick={() => patch({ category: item as AppCategory })}
                  >
                    {item}
                  </Tag>
                ))}
              </Space>
              {shown.category ? <span className="tds-field-error">{shown.category}</span> : null}
            </div>

            <div className="tds-field">
              <span className="tds-field-label">状态</span>
              <Space align="center" size={8} breakLine>
                {APP_STATUSES.map((item) => (
                  <Tag
                    key={item}
                    className="tds-pickable"
                    theme={draft.status === item ? 'primary' : 'default'}
                    variant={draft.status === item ? 'light' : 'outline'}
                    onClick={() => patch({ status: item as AppStatus })}
                  >
                    {statusLabel(item)}
                  </Tag>
                ))}
              </Space>
              {shown.status ? <span className="tds-field-error">{shown.status}</span> : null}
            </div>

            <Space align="center">
              <Button theme="primary" onClick={submit}>
                创建应用
              </Button>
              <Button variant="outline" onClick={resetForm}>
                清空
              </Button>
              <span className="tds-hint">点提交后才会显示错误，修改内容会实时重新校验</span>
            </Space>

            {createdText ? <Alert theme="success" message={createdText} /> : null}
            {createdText ? (
              <Link to="/apps" className="tds-hint tds-link-inline">
                去应用列表查看 →
              </Link>
            ) : null}
          </Space>
        </Card>

        <Card bordered title="规则速览">
          <Space direction="vertical" size={8}>
            <span className="tds-hint">
              应用名：必填，2-20 个字，不能与现有应用重名（忽略首尾空格与大小写）
            </span>
            <span className="tds-hint">负责人：必填，最多 10 个字</span>
            <span className="tds-hint">分类与状态：必须取自 core 提供的合法取值</span>
          </Space>
        </Card>
      </div>
    </div>
  );
}
