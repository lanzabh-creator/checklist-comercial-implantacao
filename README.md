# Teknisa — Intelligence Comercial

Sistema de diagnóstico comercial e geração de relatórios estratégicos.

## Deploy no Vercel (5 minutos)

### 1. Faça o upload do projeto

Extraia o ZIP e faça push para um repositório GitHub:
```bash
cd teknisa-app
git init
git add .
git commit -m "feat: Teknisa Intelligence Comercial"
git remote add origin https://github.com/SEU_USUARIO/teknisa-app.git
git push -u origin main
```

### 2. Importe no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Selecione o repositório `teknisa-app`
4. Em **Environment Variables**, adicione:
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: `sk-ant-api03-...` (sua chave da Anthropic)
5. Clique em **Deploy**

Em ~2 minutos sua aplicação estará online em `https://teknisa-app-xxx.vercel.app`.

### 3. Desenvolvimento local

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local e adicione sua ANTHROPIC_API_KEY

# Rodar localmente
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura do projeto

```
teknisa-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout global + fontes
│   │   ├── page.tsx            # Aplicação completa (React)
│   │   └── api/
│   │       └── claude/
│   │           └── route.ts    # Proxy seguro para API Anthropic
│   └── lib/
│       └── defs.ts             # Definições de todos os checklists
├── .env.local.example          # Template de variáveis de ambiente
├── next.config.js
├── package.json
└── tsconfig.json
```

## Funcionalidades

- ✅ 3 checklists: Retail/Food Service (12 seções), ERP Industrial, TecFood
- ✅ Pesquisa automática de dados públicos via IA
- ✅ Consulta CNPJ na Receita Federal com auto-preenchimento
- ✅ Geração de relatório estratégico completo (8 seções)
- ✅ Exportação PDF (impressão) e Word (.doc)
- ✅ Identidade visual Teknisa (Roboto + Poppins, paleta oficial)
- ✅ API key protegida no servidor (nunca exposta no frontend)
