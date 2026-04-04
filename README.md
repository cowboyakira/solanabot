# SOL SNIPER v2 — Proxy DexScreener + Bot Simulator

Bot de análise e simulação de estratégias para memecoins Solana,
com integração real à API do DexScreener via proxy serverless no Vercel.

---

## 📦 Estrutura do projeto

```
solsniper-proxy/
├── api/
│   └── dex.js          ← Proxy serverless (elimina CORS)
├── public/
│   └── index.html      ← Frontend completo do bot
├── vercel.json         ← Configuração Vercel
├── package.json
└── README.md
```

---

## 🚀 Deploy no Vercel — Passo a Passo

### Pré-requisitos
- Node.js 18+ instalado
- Conta gratuita em vercel.com

### 1. Instalar o Vercel CLI
```bash
npm install -g vercel
```

### 2. Entrar na pasta do projeto
```bash
cd solsniper-proxy
```

### 3. Login no Vercel
```bash
vercel login
```
Vai abrir o browser para autenticar com GitHub/Google.

### 4. Deploy para produção
```bash
vercel --prod
```
O Vercel vai perguntar algumas coisas na primeira vez:
- **Set up and deploy?** → Y
- **Which scope?** → Sua conta pessoal
- **Link to existing project?** → N
- **Project name?** → solsniper-proxy (ou qualquer nome)
- **Directory?** → . (ponto, pasta atual)
- **Override settings?** → N

Ao final, vai gerar uma URL tipo:
```
https://solsniper-proxy-abc123.vercel.app
```

### 5. Configurar no bot
1. Abra o `public/index.html` no browser
2. No painel esquerdo, em **PROXY VERCEL**, cole a URL gerada
3. Clique em **🔌 TESTAR CONEXÃO**
4. Se aparecer ✓ CONECTADO, mude para modo **LIVE API** e clique **INICIAR**

---

## 🔌 Endpoints do Proxy

Após o deploy, seu proxy disponibiliza:

| Endpoint | Descrição | Rate Limit |
|----------|-----------|------------|
| `/api/dex?path=/latest/dex/search&q=BONK` | Busca pares | 300/min |
| `/api/dex?path=/token-boosts/latest/v1` | Trending tokens | 60/min |
| `/api/dex?path=/token-profiles/latest/v1` | Perfis de tokens | 60/min |
| `/api/dex?path=/latest/dex/pairs/solana/{address}` | Par específico | 300/min |

---

## ⚙️ Desenvolvimento local

Para testar localmente antes do deploy:
```bash
npm install -g vercel   # já instalado se fez o passo 1
vercel dev              # roda em http://localhost:3000
```

---

## 🛡️ Segurança

- Apenas endpoints autorizados são permitidos (whitelist)
- Rate limit de 60 req/min por IP
- Sem API key necessária (DexScreener é público)
- CORS configurado para aceitar qualquer origem (ajuste para seu domínio em produção)

---

## 📊 Estratégias disponíveis no bot

| Estratégia | Win Rate | Rug Rate | Múltiplo médio |
|-----------|----------|----------|----------------|
| SNIPER | ~38% | ~26% | 3.8x |
| COPY WHALE | ~52% | ~8% | 2.4x |
| DIP BUY | ~48% | ~10% | 2.1x |
| MOMENTUM | ~44% | ~17% | 4.6x |

---

## 💡 Dicas de uso

1. **Teste a estratégia COPY WHALE primeiro** — menor risco de rug
2. **Active todos os filtros anti-rug** para operações reais
3. **Use TP1 em 2x com 50%** — garante capital antes de deixar correr
4. **Stop loss máximo -50%** — protege capital em rugs não detectados
5. **No modo LIVE, busque tokens por nome** no campo de busca

---

Desenvolvido com Claude · Dados: DexScreener API
