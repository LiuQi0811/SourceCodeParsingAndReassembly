// FormComponentsPage.js —— 表单组件：Input / Select / Switch / Checkbox / 表单校验
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Switch, Checkbox, RadioGroup } from '../../components/ui/Switch.js';
import { Button } from '../../components/ui/Button.js';
import { message } from '../../components/ui/Message.js';

export class FormComponentsPage extends Page {
  initialState() {
    return {
      name: '', email: '', city: null, gender: 'male',
      agree: false, subscribe: true, errors: {},
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
    ];
  }
}
