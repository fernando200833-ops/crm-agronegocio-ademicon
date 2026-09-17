import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tractor, Lock, Mail, User, ShieldCheck, ArrowRight, KeyRound, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset' | '2fa'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedTokenNotice, setGeneratedTokenNotice] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.twoFactorRequired) {
        setMode('2fa');
        toast.info('Digite o código de 6 dígitos do seu autenticador (2FA).');
        return;
      }
      toast.success(`Bem-vindo, ${data.name || 'Consultor'}!`);
      utils.auth.me.invalidate();
      onAuthenticated();
    },
    onError: (err) => {
      toast.error(err.message || 'Falha no login');
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success(`Conta criada com sucesso! Olá, ${data.name}!`);
      utils.auth.me.invalidate();
      onAuthenticated();
    },
    onError: (err) => {
      toast.error(err.message || 'Falha no cadastro');
    },
  });

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.token) {
        setGeneratedTokenNotice(data.token);
        setResetToken(data.token);
      }
      setMode('reset');
    },
    onError: (err) => {
      toast.error(err.message || 'Falha ao solicitar recuperação');
    },
  });

  const resetPasswordMutation = trpc.auth.resetPasswordWithToken.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setMode('login');
      setPassword('');
      setGeneratedTokenNotice(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Falha ao redefinir senha');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      loginMutation.mutate({ email, password });
    } else if (mode === 'register') {
      if (!name.trim()) {
        toast.error('Informe seu nome completo');
        return;
      }
      registerMutation.mutate({ name, email, password });
    } else if (mode === '2fa') {
      loginMutation.mutate({ email, password, totpCode });
    } else if (mode === 'forgot') {
      requestResetMutation.mutate({ email });
    } else if (mode === 'reset') {
      resetPasswordMutation.mutate({ token: resetToken, newPassword });
    }
  };

  const isPending =
    loginMutation.isPending ||
    registerMutation.isPending ||
    requestResetMutation.isPending ||
    resetPasswordMutation.isPending;

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#1B4D3E] text-[#88B04B] flex items-center justify-center mx-auto shadow-md">
            <Tractor className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1B4D3E]">Ademicon Agro</h1>
          <p className="text-sm text-[#5C727D]">
            Portal Seguro de Prospecção, Gestão de Carteira e Oportunidades
          </p>
        </div>

        <Card className="bg-white border-[#D1CCC1] shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#1A3643]">
              {mode === 'login' && 'Entrar no Sistema'}
              {mode === 'register' && 'Criar Conta de Consultor'}
              {mode === '2fa' && 'Autenticação em Duas Etapas (2FA)'}
              {mode === 'forgot' && 'Recuperar Senha'}
              {mode === 'reset' && 'Definir Nova Senha'}
            </CardTitle>
            <CardDescription className="text-xs text-[#5C727D]">
              {mode === 'login' && 'Insira seu e-mail e senha cadastrados para acessar a base de produtores.'}
              {mode === 'register' && 'Cadastre sua conta para receber sua carteira de atendimento.'}
              {mode === '2fa' && 'Digite o código de 6 dígitos gerado pelo seu app autenticador.'}
              {mode === 'forgot' && 'Informe seu e-mail para receber o token temporário de redefinição.'}
              {mode === 'reset' && 'Cole o token de segurança e cadastre uma nova senha.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {generatedTokenNotice && mode === 'reset' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Token de Redefinição Gerado:
                </span>
                <p className="font-mono break-all bg-white p-1.5 rounded border border-amber-200 text-[11px]">
                  {generatedTokenNotice}
                </p>
                <p className="text-[10px] text-amber-700">O token expira em 1 hora e foi pré-preenchido no formulário.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A3643] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#1B4D3E]" /> Nome Completo
                  </label>
                  <Input
                    placeholder="Seu nome ou consultor responsável"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                  />
                </div>
              )}

              {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A3643] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#1B4D3E]" /> E-mail Profissional
                  </label>
                  <Input
                    type="email"
                    placeholder="seu.email@ademicon.agro ou pessoal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                  />
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#1A3643] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#1B4D3E]" /> Senha de Acesso
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-[#1B4D3E] font-medium hover:underline"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    placeholder={mode === 'register' ? 'Mínimo de 6 caracteres' : 'Sua senha'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                  />
                </div>
              )}

              {mode === '2fa' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A3643] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#1B4D3E]" /> Código de Verificação (6 dígitos)
                  </label>
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    className="bg-[#F5F2EB]/50 border-[#D1CCC1] text-center text-lg tracking-widest font-mono"
                  />
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1A3643]">Token de Segurança</label>
                    <Input
                      placeholder="Cole o token recebido"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      className="bg-[#F5F2EB]/50 border-[#D1CCC1] font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1A3643]">Nova Senha</label>
                    <Input
                      type="password"
                      placeholder="Mínimo de 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#1B4D3E] hover:bg-[#1B4D3E]/90 text-white font-bold h-10 mt-2"
              >
                {isPending ? (
                  'Processando...'
                ) : mode === 'login' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    Entrar no Painel <ArrowRight className="w-4 h-4" />
                  </span>
                ) : mode === 'register' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    Concluir Cadastro & Entrar <ArrowRight className="w-4 h-4" />
                  </span>
                ) : mode === '2fa' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    Confirmar Código <ArrowRight className="w-4 h-4" />
                  </span>
                ) : mode === 'forgot' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    Gerar Token de Redefinição <RotateCcw className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Salvar Nova Senha & Concluir <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#D1CCC1]/60 text-center text-xs text-[#5C727D] space-y-2">
              {mode === 'login' ? (
                <p>
                  Ainda não tem acesso?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="font-bold text-[#1B4D3E] hover:underline"
                  >
                    Cadastre-se aqui
                  </button>
                </p>
              ) : (
                <p>
                  Voltar para{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-bold text-[#1B4D3E] hover:underline"
                  >
                    Tela de login
                  </button>
                </p>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#5C727D]/80 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#88B04B]" />
                Autenticação reforçada com criptografia Scrypt e TOTP 2FA
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
