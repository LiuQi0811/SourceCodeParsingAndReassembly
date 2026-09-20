import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  decryptAlgo: string;
  setDecryptAlgo: (v: string) => void;
  ciphertext: string;
  setCiphertext: (v: string) => void;
  decryptKey: string;
  setDecryptKey: (v: string) => void;
  decryptOutput: string;
  runDecryptTest: () => void;
}

export default function DecryptTab({
  decryptAlgo,
  setDecryptAlgo,
  ciphertext,
  setCiphertext,
  decryptKey,
  setDecryptKey,
  decryptOutput,
  runDecryptTest,
}: Props) {
  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <Shield className="h-4 w-4" />
            前端反爬逆向解密套件工坊 (Strategy Pattern)
          </CardTitle>
          <div className="flex gap-1">
            {['base64', 'xor', 'aes', 'rc4', 'custom_js'].map((algo) => (
              <Button
                key={algo}
                size="sm"
                variant="ghost"
                onClick={() => setDecryptAlgo(algo)}
                className={`h-7 px-2 text-xs uppercase font-bold ${
                  decryptAlgo === algo
                    ? 'bg-accent text-accent-foreground hover:bg-accent'
                    : 'text-muted-foreground hover:text-accent-foreground'
                }`}
              >
                {algo}
              </Button>
            ))}
          </div>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          支持 Base64变种、AES-CBC/ECB、XOR异或混淆、RC4流密码及自定义动态 JS 逆向 Hook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-muted-foreground">输入加密密文 (Ciphertext):</label>
              <Textarea
                rows={4}
                value={ciphertext}
                onChange={(e) => setCiphertext(e.target.value)}
                className="bg-background border-primary/30 font-mono text-xs text-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground">解密密钥 / 参数 (Key / Params):</label>
              <Input
                value={decryptKey}
                onChange={(e) => setDecryptKey(e.target.value)}
                className="bg-background border-primary/30 font-mono text-xs text-foreground"
              />
            </div>
            <Button onClick={runDecryptTest} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
              执行逆向解密 ({decryptAlgo.toUpperCase()})
            </Button>
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground">逆向还原明文载荷 (Decrypted Payload):</label>
            <pre className="p-3 rounded bg-background border border-primary/30 font-mono text-xs text-primary h-[178px] overflow-auto">
              {decryptOutput}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
