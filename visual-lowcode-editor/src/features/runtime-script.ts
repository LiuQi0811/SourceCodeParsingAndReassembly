/**
 * 页面交互运行时
 *
 * 导出 HTML 时注入到 </body> 前的 IIFE 脚本，零外部依赖。
 * 功能：
 *   1. 扫描所有带 data-events 的元素，绑定事件 → 动作
 *   2. 内置动作执行器：show/hide/toggle/setText/setStyle/scrollTo/alert/navigate/custom/submitForm/resetForm
 *   3. 提供极简 $() API 给自定义代码使用
 *
 * data-events 格式（JSON）：
 *   {
 *     "click": [
 *       { "id": "act-1", "type": "show", "targetId": "xxx" },
 *       { "id": "act-2", "type": "custom", "code: "console.log('hello')" }
 *     ]
 *   }
 */

export const runtimeScript = `(function () {
  'use strict';

  function $(id) {
    var el = document.querySelector('[data-node-id="' + id + '"]');
    if (!el) return { _missing: true };

    return {
      el: el,
      show: function () { el.style.display = ''; return this; },
      hide: function () { el.style.display = 'none'; return this; },
      toggle: function () {
        el.style.display = (el.style.display === 'none') ? '' : 'none';
        return this;
      },
      text: function (t) {
        if (arguments.length === 0) return el.textContent;
        el.textContent = t == null ? '' : String(t);
        return this;
      },
      html: function (h) {
        if (arguments.length === 0) return el.innerHTML;
        el.innerHTML = h == null ? '' : String(h);
        return this;
      },
      css: function (k, v) {
        if (arguments.length === 1) return el.style.getPropertyValue(k);
        el.style.setProperty(k, v == null ? '' : String(v));
        return this;
      },
      val: function (v) {
        if (arguments.length === 0) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            return el.value;
          }
          return null;
        }
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          el.value = String(v);
        }
        return this;
      },
      scrollTo: function () {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return this;
      },
      on: function (eventName, handler) {
        el.addEventListener(eventName, handler);
        return this;
      },
      off: function (eventName, handler) {
        el.removeEventListener(eventName, handler);
        return this;
      },
    };
  }

  function runAction(action, event) {
    switch (action.type) {
      case 'show':
        $(action.targetId).show();
        break;
      case 'hide':
        $(action.targetId).hide();
        break;
      case 'toggle':
        $(action.targetId).toggle();
        break;
      case 'setText':
        $(action.targetId).text(action.text || '');
        break;
      case 'setStyle':
        $(action.targetId).css(action.styleKey || '', action.styleValue || '');
        break;
      case 'scrollTo':
        $(action.targetId).scrollTo();
        break;
      case 'alert':
        alert(action.message || '');
        break;
      case 'navigate':
        if (!action.url) break;
        if (action.openInNewTab === 'true') {
          window.open(action.url, '_blank', 'noopener');
        } else {
          window.location.href = action.url;
        }
        break;
      case 'submitForm': {
        var form = document.querySelector('form[data-node-id="' + action.formId + '"]');
        if (!form) break;
        event && event.preventDefault && event.preventDefault();

        var data = {};
        var inputs = form.querySelectorAll('input, textarea, select');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var name = el.name || el.getAttribute('data-name');
          if (!name) continue;
          if (el.type === 'checkbox') {
            data[name] = el.checked ? el.value || 'on' : '';
          } else if (el.type === 'radio') {
            if (el.checked) data[name] = el.value;
          } else {
            data[name] = el.value;
          }
        }

        // 模拟提交成功；若配置了 action 则真正提交
        if (form.action && form.action !== '' && form.action !== '#') {
          form.submit();
        } else {
          var msg = action.successMessage || '提交成功！';
          if (msg) alert(msg);
        }
        break;
      }
      case 'resetForm': {
        var formEl = document.querySelector('form[data-node-id="' + action.formId + '"]');
        if (formEl) formEl.reset();
        break;
      }
      case 'custom':
        try {
          // 自定义代码在闭包内执行，暴露 $ API 和 event 参数
          new Function('$', 'event', action.code || '')($, event);
        } catch (err) {
          console.error('自定义脚本执行错误：', err);
        }
        break;
    }
  }

  function bindEvents(element) {
    var raw = element.getAttribute('data-events');
    if (!raw) return;
    var events = {};
    try {
      events = JSON.parse(raw);
    } catch (e) {
      console.error('解析 data-events 失败：', e);
      return;
    }

    Object.keys(events).forEach(function (eventName) {
      var actions = events[eventName];
      if (!Array.isArray(actions)) return;

      // form 的 submit 事件需要特殊处理：绑在 form 元素上
      element.addEventListener(eventName, function (event) {
        // 表单提交默认阻止（避免页面跳转），由 submitForm 动作控制
        if (eventName === 'submit') {
          event.preventDefault();
        }
        actions.forEach(function (action) {
          runAction(action, event);
        });
      });
    });
  }

  function init() {
    var nodes = document.querySelectorAll('[data-events]');
    for (var i = 0; i < nodes.length; i++) {
      bindEvents(nodes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给自定义脚本的全局 API
  window.$lc = { $: $ };
})();
`;
