// FormComponentsPage.js —— 表单组件：Input / Select / Switch / Checkbox / 表单校验
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Switch, Checkbox, Radio, RadioGroup } from '../../components/ui/Switch.js';
import { Button } from '../../components/ui/Button.js';
import { message } from '../../components/ui/Message.js';
import { DatePicker, RangePicker } from '../../components/ui/DatePicker.js';
import { TimePicker } from '../../components/ui/TimePicker.js';
import { Cascader } from '../../components/ui/Cascader.js';
import { TreeSelect } from '../../components/ui/TreeSelect.js';
import { AutoComplete } from '../../components/ui/AutoComplete.js';
import { Mentions } from '../../components/ui/Mentions.js';
import { ColorPicker } from '../../components/ui/ColorPicker.js';
import { Transfer } from '../../components/ui/Transfer.js';
import { InputNumber } from '../../components/ui/InputNumber.js';

export class FormComponentsPage extends Page {
  initialState() {
    return {
      name: '', email: '', city: null, gender: 'male',
      agree: false, subscribe: true, errors: {},
      radioChecked: true,
    };
  }

  _validate() {
    const errors = {};
    if (!this.state.name.trim()) errors.name = '请输入姓名';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.state.email)) errors.email = '邮箱格式不正确';
    if (!this.state.city) errors.city = '请选择城市';
    if (!this.state.agree) errors.agree = '请同意条款';
    return errors;
  }

  _submit() {
    const errors = this._validate();
    this.setState({ errors });
    if (Object.keys(errors).length > 0) {
      message.error('表单校验未通过');
      return;
    }
    message.success(`提交成功：${this.state.name} / ${this.state.email}`);
    console.log('表单数据', {
      name: this.state.name, email: this.state.email, city: this.state.city,
      gender: this.state.gender, agree: this.state.agree, subscribe: this.state.subscribe,
    });
  }

  renderPage() {
    const { errors } = this.state;

    // 受控输入
    const nameInput = new Input({
      value: this.state.name, placeholder: '请输入姓名', error: !!errors.name,
      onChange: (v) => { this.state.name = v; },
    });
    this.registerChild(nameInput);

    const emailInput = new Input({
      value: this.state.email, placeholder: '请输入邮箱', type: 'email', error: !!errors.email,
      addonAfter: '@', onChange: (v) => { this.state.email = v; },
    });
    this.registerChild(emailInput);

    const citySelect = new Select({
      value: this.state.city, placeholder: '请选择城市',
      options: [
        { value: 'bj', label: '北京' }, { value: 'sh', label: '上海' },
        { value: 'gz', label: '广州' }, { value: 'sz', label: '深圳' },
        { value: 'hz', label: '杭州', disabled: true },
      ],
      onChange: (v) => { this.state.city = v; },
    });
    this.registerChild(citySelect);

    const genderRadio = new RadioGroup({
      value: this.state.gender,
      options: [
        { value: 'male', label: '男' }, { value: 'female', label: '女' },
      ],
      onChange: (v) => { this.state.gender = v; },
    });
    this.registerChild(genderRadio);

    const agreeCheckbox = new Checkbox({
      checked: this.state.agree, label: '我已阅读并同意条款',
      onChange: (v) => { this.state.agree = v; },
    });
    this.registerChild(agreeCheckbox);

    const subscribeSwitch = new Switch({
      checked: this.state.subscribe, onChange: (v) => { this.state.subscribe = v; },
    });
    this.registerChild(subscribeSwitch);

    const submitBtn = new Button({
      type: 'primary', children: '提交表单', onClick: () => this._submit(),
    });
    this.registerChild(submitBtn);

    const resetBtn = new Button({
      children: '重置',
      onClick: () => this.setState({
        name: '', email: '', city: null, gender: 'male', agree: false, subscribe: true, errors: {},
      }),
    });
    this.registerChild(resetBtn);

    return [
      h('h2', { class: 'section-title' }, '表单组件'),

      h(Card, { title: '表单校验示例（策略模式）' },
        h('div', { class: 'flex flex-col gap-md', style: { maxWidth: '480px' } },
          // 姓名
          h('div', {},
            h('label', { class: 'form-item__label is-required' }, '姓名'),
            nameInput.render(),
            h('div', { class: 'form-item__error' }, errors.name || ''),
          ),
          // 邮箱
          h('div', {},
            h('label', { class: 'form-item__label is-required' }, '邮箱'),
            emailInput.render(),
            h('div', { class: 'form-item__error' }, errors.email || ''),
          ),
          // 城市
          h('div', {},
            h('label', { class: 'form-item__label is-required' }, '城市'),
            citySelect.render(),
            h('div', { class: 'form-item__error' }, errors.city || ''),
          ),
          // 性别
          h('div', {},
            h('label', { class: 'form-item__label' }, '性别'),
            genderRadio.render(),
          ),
          // 同意条款
          h('div', {},
            agreeCheckbox.render(),
            h('div', { class: 'form-item__error' }, errors.agree || ''),
          ),
          // 订阅
          h('div', { class: 'flex items-center justify-between' },
            h('span', {}, '订阅邮件通知'),
            subscribeSwitch.render(),
          ),
          // 按钮
          h('div', { class: 'flex gap-sm' }, submitBtn.render(), resetBtn.render()),
        ),
      ),

      h(Card, { title: 'Input 输入框变体' },
        h('div', { class: 'flex flex-col gap-md', style: { maxWidth: '480px' } },
          (() => {
            const i = new Input({ placeholder: '默认尺寸' }); this.registerChild(i); return i.render();
          })(),
          (() => {
            const i = new Input({ placeholder: '大尺寸', size: 'lg' }); this.registerChild(i); return i.render();
          })(),
          (() => {
            const i = new Input({ placeholder: '小尺寸', size: 'sm' }); this.registerChild(i); return i.render();
          })(),
          (() => {
            const i = new Input({ placeholder: '带前缀', addonBefore: 'https://' }); this.registerChild(i); return i.render();
          })(),
          (() => {
            const i = new Input({ placeholder: '禁用', disabled: true }); this.registerChild(i); return i.render();
          })(),
          (() => {
            const i = new Input({ placeholder: '多行文本', multiline: true, rows: 3 }); this.registerChild(i); return i.render();
          })(),
        ),
      ),

      h(Card, { title: 'Radio 单选项' },
        h('div', { class: 'flex flex-col gap-md' },
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
            (() => {
              const r = new Radio({
                label: '单独的 Radio', value: 'a', checked: this.state.radioChecked,
                onChange: () => this.setState({ radioChecked: !this.state.radioChecked }),
              });
              this.registerChild(r);
              return r.render();
            })(),
          ),
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '禁用'),
            (() => {
              const r1 = new Radio({ label: '选中-禁用', value: 'a', checked: true, disabled: true });
              this.registerChild(r1);
              const r2 = new Radio({ label: '未选-禁用', value: 'b', checked: false, disabled: true });
              this.registerChild(r2);
              return h('div', { class: 'flex gap-md' }, r1.render(), r2.render());
            })(),
          ),
          h('p', { class: 'text-secondary fs-sm' }, '提示：互斥单选请使用 RadioGroup（见上方表单校验示例）。'),
        ),
      ),

      // DatePicker
      h(Card, { title: 'DatePicker 日期选择器' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const dp = new DatePicker({ placeholder: '请选择日期' }); this.registerChild(dp); return dp.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '可清除'),
          (() => { const dp = new DatePicker({ placeholder: '选择日期', allowClear: true, showToday: true }); this.registerChild(dp); return dp.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '范围选择'),
          (() => { const rp = new RangePicker({}); this.registerChild(rp); return rp.render(); })(),
        ),
      ),

      // TimePicker
      h(Card, { title: 'TimePicker 时间选择器' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const tp = new TimePicker({ placeholder: '请选择时间' }); this.registerChild(tp); return tp.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '12 小时制'),
          (() => { const tp = new TimePicker({ placeholder: '选择时间', use12Hours: true }); this.registerChild(tp); return tp.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '步长'),
          (() => { const tp = new TimePicker({ placeholder: '选择时间', hourStep: 2, minuteStep: 5 }); this.registerChild(tp); return tp.render(); })(),
        ),
      ),

      // Cascader
      h(Card, { title: 'Cascader 级联选择' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const c = new Cascader({
            placeholder: '请选择',
            options: [
              { value: 'zhejiang', label: '浙江', children: [
                { value: 'hangzhou', label: '杭州', children: [{ value: 'xihu', label: '西湖' }] },
              ] },
              { value: 'jiangsu', label: '江苏', children: [
                { value: 'nanjing', label: '南京', children: [{ value: 'zhonghuamen', label: '中华门' }] },
              ] },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '可选任意级'),
          (() => { const c = new Cascader({
            placeholder: '请选择',
            changeOnSelect: true,
            options: [
              { value: 'a', label: '选项 A', children: [{ value: 'a1', label: 'A-1' }] },
              { value: 'b', label: '选项 B' },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
      ),

      // TreeSelect
      h(Card, { title: 'TreeSelect 树选择' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const c = new TreeSelect({
            placeholder: '请选择',
            treeDefaultExpandAll: true,
            treeData: [
              { value: 'zhejiang', title: '浙江', children: [{ value: 'hangzhou', title: '杭州' }] },
              { value: 'jiangsu', title: '江苏', children: [{ value: 'nanjing', title: '南京' }] },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '多选'),
          (() => { const c = new TreeSelect({
            placeholder: '请选择',
            multiple: true,
            treeDefaultExpandAll: true,
            treeData: [
              { value: 'a', title: '选项 A' },
              { value: 'b', title: '选项 B', children: [
                { value: 'b1', title: 'B-1' },
                { value: 'b2', title: 'B-2' },
              ] },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
      ),

      // AutoComplete
      h(Card, { title: 'AutoComplete 自动补全' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const c = new AutoComplete({
            placeholder: '输入试试（如 Be）',
            options: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'],
          }); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '对象选项'),
          (() => { const c = new AutoComplete({
            placeholder: '输入',
            options: [
              { value: '1', label: '选项一' },
              { value: '2', label: '选项二' },
              { value: '3', label: '选项三' },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
      ),

      // Mentions
      h(Card, { title: 'Mentions 提及' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const c = new Mentions({
            placeholder: '输入 @ 触发提及',
            options: [
              { value: 'alice', label: 'Alice' },
              { value: 'bob', label: 'Bob' },
              { value: 'charlie', label: 'Charlie' },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '自定义前缀'),
          (() => { const c = new Mentions({
            placeholder: '输入 # 触发',
            prefix: '#',
            options: [
              { value: 'tag1', label: '标签一' },
              { value: 'tag2', label: '标签二' },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
      ),

      // ColorPicker
      h(Card, { title: 'ColorPicker 颜色选择器' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'),
          (() => { const c = new ColorPicker({}); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '显示文字'),
          (() => { const c = new ColorPicker({ showText: true, defaultValue: '#52c41a' }); this.registerChild(c); return c.render(); })(),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '预设色'),
          (() => { const c = new ColorPicker({
            showText: true,
            presets: [
              { label: '推荐', colors: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f'] },
            ],
          }); this.registerChild(c); return c.render(); })(),
        ),
      ),

      // Transfer
      h(Card, { title: 'Transfer 穿梭框' },
        (() => { const c = new Transfer({
          dataSource: [
            { key: '1', title: '选项一', description: '描述一' },
            { key: '2', title: '选项二', description: '描述二' },
            { key: '3', title: '选项三', description: '描述三' },
            { key: '4', title: '选项四', description: '描述四' },
          ],
          targetKeys: ['2'],
          titles: ['源列表', '目标列表'],
        }); this.registerChild(c); return c.render(); })(),
      ),

      // InputNumber
      h(Card, { title: 'InputNumber 数字输入框' },
        h('div', { style: 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;' },
          (() => { const c = new InputNumber({ min: 0, max: 100, defaultValue: 5, size: 'middle',
            onChange: (v) => message.info(`值变更：${v}`) }); this.registerChild(c); return c.render(); })(),
          (() => { const c = new InputNumber({ min: 0, step: 0.1, precision: 1, defaultValue: 1.5,
            size: 'large' }); this.registerChild(c); return c.render(); })(),
          (() => { const c = new InputNumber({ min: 0, max: 10, defaultValue: 0, size: 'small',
            disabled: true }); this.registerChild(c); return c.render(); })(),
          (() => { const c = new InputNumber({ min: 0, max: 1000, defaultValue: 100, step: 10,
            formatter: (v) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
            parser: (s) => s.replace(/¥\s?|(,*)/g, '') }); this.registerChild(c); return c.render(); })(),
        ),
        h('p', { style: 'margin-top:12px; color:var(--color-text-tertiary); font-size:13px;' },
          '提示：键盘 ↑/↓ 调整数值，Enter 提交。'),
      ),
    ];
  }
}
