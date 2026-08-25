import { useState } from 'react';
import { Check, Trash2, Globe, ExternalLink } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { cn } from '@lib/utils';

type Lang = 'zh' | 'en';

const CONTENT: Record<Lang, {
  langText: string;
  mainTitle: string;
  subtitle: string;
  welcomeTitle: string;
  privacyTitle: string;
  privacyBody: string;
  disclaimerTitle: string;
  disclaimerBody: string;
  issueTitle: string;
  agreement: string;
  agree: string;
  uninstall: string;
}> = {
  zh: {
    langText: 'English',
    mainTitle: '恭喜 猫抓 扩展已成功安装 !',
    subtitle: 'Installation successful !',
    welcomeTitle: '希望本扩展能帮助到你',
    privacyTitle: '隐私政策',
    privacyBody: '本扩展收集所有信息都在本地储存处理,不会发送到远程服务器,不包含任何跟踪器。',
    disclaimerTitle: '免责声明',
    disclaimerBody: '本扩展仅供下载用户拥有版权或已获授权的视频,禁止用于下载受版权保护且未经授权的内容。用户需自行承担使用本工具的全部法律责任,开发者不对用户的任何行为负责。本工具按"原样"提供,开发者不承担任何直接或间接责任。',
    issueTitle: '问题提交',
    agreement: '点击"同意"或"关闭本页面"即表示您已阅读并同意以上内容。',
    agree: '同意',
    uninstall: '卸载扩展',
  },
  en: {
    langText: '中文',
    mainTitle: 'Congratulations! cat-catch extension installed!',
    subtitle: '安装成功 !',
    welcomeTitle: 'Hope this extension helps you',
    privacyTitle: 'Privacy Policy',
    privacyBody: 'The extension collects and processes all information locally without sending it to remote servers and does not include any trackers.',
    disclaimerTitle: 'Disclaimer',
    disclaimerBody: 'This extension is intended for downloading videos that you own or have authorized access to. It is prohibited to use this tool for downloading copyrighted content without permission. Users are solely responsible for their actions, and the developer is not liable for any user behavior. This tool is provided "as-is," and the developer assumes no direct or indirect liability.',
    issueTitle: 'Issue Submission',
    agreement: 'By clicking "Agree" or "Close this page," you confirm that you have read and agree to the above terms.',
    agree: 'Agree',
    uninstall: 'Uninstall',
  },
};

export default function App() {
  const [lang, setLang] = useState<Lang>('zh');
  const [closing, setClosing] = useState(false);
  const t = CONTENT[lang];

  const handleAgree = () => {
    // 标记已同意,关闭页面
    chrome.storage.local.set({ installAgreed: true }).finally(() => {
      setClosing(true);
      setTimeout(() => window.close(), 300);
    });
  };

  const handleUninstall = () => {
    if (lang === 'zh') {
      if (!confirm('确定卸载猫抓扩展?')) return;
    } else {
      if (!confirm('Uninstall cat-catch extension?')) return;
    }
    chrome.management.uninstallSelf();
  };

  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-b from-[var(--color-surface-dim] to-[var(--color-surface] text-[var(--color-text] transition-opacity',
        closing && 'opacity-0',
      )}
    >
      {/* 语言切换 */}
      <div className="max-w-3xl mx-auto px-4 pt-6 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          <Globe className="w-4 h-4 mr-1" />
          {t.langText}
        </Button>
      </div>

      {/* 头部 */}
      <header className="text-center px-4 py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary]/10 mb-4">
          <img
            src={typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('img/icon128.png') : 'img/icon128.png'}
            alt="logo"
            className="w-12 h-12"
          />
        </div>
        <h1 className="text-2xl font-semibold">{t.mainTitle}</h1>
        <div className="text-sm text-[var(--color-text-muted] mt-1">{t.subtitle}</div>
      </header>

      {/* 卡片 */}
      <main className="max-w-3xl mx-auto px-4 pb-10">
        <div className="bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-6 space-y-6 shadow-sm animate-[fadeIn_0.4s_ease]">
          <div className="flex items-center gap-2 text-lg font-medium">
            <span>🙌</span>
            <span>{t.welcomeTitle}</span>
          </div>

          {/* 隐私政策 */}
          <Section emoji="🔒" title={t.privacyTitle}>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted]">
              {t.privacyBody}
            </p>
          </Section>

          {/* 免责声明 */}
          <Section emoji="⚠️" title={t.disclaimerTitle}>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted]">
              {t.disclaimerBody}
            </p>
          </Section>

          {/* 问题提交 */}
          <Section emoji="🚨" title={t.issueTitle}>
            <a
              href="https://cat-catch.94cat.com/docs/issues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary] hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              https://cat-catch.94cat.com/docs/issues
            </a>
          </Section>

          {/* 同意声明 */}
          <p className="text-xs text-[var(--color-text-muted] text-center pt-2 border-t border-[var(--color-border]">
            {t.agreement}
          </p>

          {/* 按钮 */}
          <div className="flex gap-3 justify-center">
            <Button variant="primary" size="md" onClick={handleAgree}>
              <Check className="w-4 h-4 mr-1" />
              {t.agree}
            </Button>
            <Button variant="outline" size="md" onClick={handleUninstall}>
              <Trash2 className="w-4 h-4 mr-1" />
              {t.uninstall}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      <div className="bg-[var(--color-surface-dim] rounded-[--radius-sm] p-3">
        {children}
      </div>
    </div>
  );
}
