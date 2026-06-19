'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { DEFS, Field } from '@/lib/defs'

// ── helpers ──────────────────────────────────────────────
function maskCnpj(v: string) {
  v = v.replace(/\D/g, '').slice(0, 14)
  if (v.length > 12) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12)
  else if (v.length > 8) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8)
  else if (v.length > 5) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5)
  else if (v.length > 2) v = v.slice(0,2)+'.'+v.slice(2)
  return v
}
async function callClaude(prompt: string, useWebSearch = false, maxTokens = 2000) {
  const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, useWebSearch, maxTokens }) })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text as string
}
function mdToHtml(md: string): string {
  let out = '', inUl = false, openBody = false
  const cUl = () => { if (inUl) { out += '</ul>'; inUl = false } }
  const cSec = () => { if (openBody) { out += '</div></div>'; openBody = false } }
  const fmt = (s: string) => s
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em style="color:#F4B800;font-style:normal">$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g,'<em style="color:#F4B800;font-style:normal;font-weight:600">$1</em>')
    .replace(/✅/g,'<span style="color:#059E1E">✅</span>')
    .replace(/⚠️/g,'<span style="color:#F4B800">⚠️</span>')
    .replace(/❌/g,'<span style="color:#e84d4d">❌</span>')
  for (const l of md.split('\n')) {
    if (/^# /.test(l)) { cUl(); continue }
    if (/^## /.test(l)) { cUl(); cSec(); const t = l.replace(/^## /,'').replace(/\*\*/g,''); out += `<div class="rs"><div class="rs-ttl">${t}</div><div class="rs-body">`; openBody = true; continue }
    if (/^### /.test(l)) { cUl(); out += `<h3>${fmt(l.replace(/^### /,''))}</h3>`; continue }
    if (/^---+$/.test(l.trim())) { cUl(); cSec(); continue }
    if (/^[-*] /.test(l)) { if (!inUl) { out += '<ul>'; inUl = true } out += `<li>${fmt(l.replace(/^[-*] /,''))}</li>`; continue }
    if (/^\d+\. /.test(l)) { if (!inUl) { out += '<ul>'; inUl = true } out += `<li>${fmt(l.replace(/^\d+\. /,''))}</li>`; continue }
    if (/^> /.test(l)) { cUl(); out += `<blockquote>${fmt(l.replace(/^> /,''))}</blockquote>`; continue }
    if (!l.trim()) { cUl(); continue }
    cUl(); out += `<p>${fmt(l)}</p>`
  }
  cUl(); cSec(); return out
}

// ── types ─────────────────────────────────────────────────
type FDValue = string | string[]
type FormData = Record<string, FDValue>

export default function Home() {
  // ── Inicializa estado a partir do localStorage ────────────
  const [cl, setCl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('tk_cl') || null
  })
  const [sec, setSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem('tk_sec') || '0') || 0
  })
  const [fd, setFd] = useState<FormData>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('tk_fd') || '{}') } catch { return {} }
  })
  const [page, setPage] = useState<'checklist'|'report'>('checklist')
  const [reportHtml, setReportHtml] = useState('')
  const [reportMd, setReportMd] = useState('')
  const [loading, setLoading] = useState(false)
  const [researchLoading, setResearchLoading] = useState(false)
  const [sefazLoading, setSefazLoading] = useState(false)
  const [sefazResult, setSefazResult] = useState<Record<string,string> | null>(null)
  const [sefazCnpj, setSefazCnpj] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [tooltipText, setTooltipText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const def = cl ? DEFS[cl] : null
  const sections = def?.sections ?? []
  const currentSec = sections[sec]
  const clientName = String(fd['razao_social'] || '—')

  // progress
  const { total, filled } = sections.reduce((acc, s) => {
    s.fields.forEach(f => {
      if (f.type === 'pdf_upload') return
      acc.total++
      const v = fd[f.id]
      if (v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione')) acc.filled++
    })
    return acc
  }, { total: 0, filled: 0 })
  const pct = total ? Math.round(filled / total * 100) : 0

  const setField = useCallback((id: string, val: FDValue) => {
    setFd(prev => ({ ...prev, [id]: val }))
  }, [])

  const toggleChip = useCallback((id: string, val: string) => {
    setFd(prev => {
      const cur = Array.isArray(prev[id]) ? (prev[id] as string[]) : []
      return { ...prev, [id]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] }
    })
  }, [])

  const isSectionDone = (idx: number) => {
    const s = sections[idx]
    if (!s) return false
    let sf = 0, st = 0
    s.fields.forEach(f => {
      if (f.type === 'pdf_upload') return
      st++
      const v = fd[f.id]
      if (v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione')) sf++
    })
    return sf > 0 && sf === st
  }

  // ── Persistência no localStorage ─────────────────────────
  useEffect(() => {
    if (cl) localStorage.setItem('tk_cl', cl)
    else localStorage.removeItem('tk_cl')
  }, [cl])

  useEffect(() => {
    if (cl) localStorage.setItem(`tk_sec_${cl}`, String(sec))
    localStorage.setItem('tk_sec', String(sec))
  }, [sec, cl])

  useEffect(() => {
    if (!cl) return
    try {
      const fdSafe = Object.fromEntries(
        Object.entries(fd).filter(([k, v]) =>
          !k.endsWith('_upload') && !(typeof v === 'string' && v.startsWith('data:'))
        )
      )
      localStorage.setItem(`tk_fd_${cl}`, JSON.stringify(fdSafe))
      localStorage.setItem('tk_fd', JSON.stringify(fdSafe))
    } catch { /* quota excedida */ }
  }, [fd, cl])

  // ── Reiniciar checklist ───────────────────────────────────
  const resetChecklist = () => {
    if (!confirm('Tem certeza que deseja reiniciar o checklist? Todos os dados preenchidos serão apagados.')) return
    setFd({})
    setSec(0)
    setSefazResult(null)
    setSefazCnpj('')
    if (cl) {
      localStorage.removeItem(`tk_fd_${cl}`)
      localStorage.removeItem(`tk_sec_${cl}`)
    }
    localStorage.removeItem('tk_fd')
    localStorage.setItem('tk_sec', '0')
  }
      const v = fd[f.id]
      if (v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione')) sf++
    })
    return sf > 0 && sf === st
  }

  // ── AI calls ──────────────────────────────────────────────
  const doResearch = async () => {
    const nome = String(fd['razao_social'] || '')
    const cnpjRaw = String(fd['cnpj'] || '').replace(/\D/g, '')
    const site = String(fd['site'] || '')
    if (!nome && !cnpjRaw && !site) { alert('Preencha ao menos o nome ou CNPJ antes de pesquisar.'); return }
    setResearchLoading(true)
    try {
      const lines: string[] = []

      // ── 1. BrasilAPI CNPJ (gratuita, sem autenticação) ──
      if (cnpjRaw.length === 14) {
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjRaw}`)
          if (r.ok) {
            const d = await r.json()
            lines.push('## Dados da Receita Federal')
            lines.push(`Razão Social: ${d.razao_social || '—'}`)
            lines.push(`Nome Fantasia: ${d.nome_fantasia || '—'}`)
            lines.push(`Situação Cadastral: ${d.descricao_situacao_cadastral || '—'}`)
            lines.push(`Porte: ${d.porte || '—'}`)
            lines.push(`Natureza Jurídica: ${d.natureza_juridica || '—'}`)
            lines.push(`Capital Social: R$ ${Number(d.capital_social || 0).toLocaleString('pt-BR')}`)
            lines.push(`Atividade Principal (CNAE ${d.cnae_fiscal}): ${d.cnae_fiscal_descricao || '—'}`)
            lines.push(`Data de Abertura: ${d.data_inicio_atividade || '—'}`)
            lines.push(`Município / UF: ${d.municipio || '—'} / ${d.uf || '—'}`)
            lines.push(`Endereço: ${[d.logradouro, d.numero, d.bairro, d.cep].filter(Boolean).join(', ') || '—'}`)
            lines.push(`E-mail: ${d.email || '—'}`)
            lines.push(`Telefone: ${d.ddd_telefone_1 || '—'}`)
            if (d.qsa?.length) {
              lines.push(`Quadro Societário: ${d.qsa.map((s: Record<string,string>) => `${s.nome_socio} (${s.qualificacao_socio})`).join('; ')}`)
            }
            // Atividades secundárias
            if (d.cnaes_secundarios?.length) {
              lines.push(`Atividades Secundárias: ${d.cnaes_secundarios.slice(0, 3).map((c: Record<string,string>) => c.descricao).join('; ')}`)
            }
            // Auto-preenche razão social se vazio
            if (!fd['razao_social'] && d.razao_social) {
              setField('razao_social', d.razao_social)
            }
          }
        } catch {}
      }

      // ── 2. BrasilAPI Simples Nacional ───────────────────
      if (cnpjRaw.length === 14) {
        try {
          const r = await fetch(`https://brasilapi.com.br/api/simples/v1/${cnpjRaw}`)
          if (r.ok) {
            const d = await r.json()
            lines.push('')
            lines.push('## Simples Nacional / MEI')
            lines.push(`Optante Simples Nacional: ${d.simples?.optante ? 'Sim' : 'Não'}`)
            lines.push(`Data de Opção: ${d.simples?.data_opcao || '—'}`)
            lines.push(`Optante MEI: ${d.mei?.optante ? 'Sim' : 'Não'}`)
          }
        } catch {}
      }

      // ── 3. Google News RSS (público, sem autenticação) ──
      if (nome) {
        try {
          const query = encodeURIComponent(`"${nome}"`)
          const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
          // Usa proxy CORS público para ler o RSS
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`
          const r = await fetch(proxyUrl)
          if (r.ok) {
            const data = await r.json()
            const xml = data.contents as string
            // Extrai títulos e fontes dos itens do RSS
            const items = Array.from(xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g))
            if (items.length > 0) {
              lines.push('')
              lines.push('## Notícias Recentes (Google News)')
              items.slice(0, 8).forEach(m => {
                const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim()
                const source = m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
                const date = m[3].trim()
                lines.push(`• ${title} — ${source} (${date})`)
              })
            } else {
              lines.push('')
              lines.push('## Notícias Recentes')
              lines.push('Nenhuma notícia recente encontrada no Google News.')
            }
          }
        } catch {}
      }

      // ── 4. Campos complementares de orientação ──────────
      lines.push('')
      lines.push('## Observações para Preenchimento Manual')
      lines.push('Os campos abaixo precisam ser levantados diretamente com o cliente:')
      lines.push('• Número de funcionários / colaboradores')
      lines.push('• Faturamento anual detalhado (se não divulgado)')
      lines.push('• Estrutura de TI e sistemas utilizados')
      lines.push('• Expansão planejada')
      lines.push('• Concorrentes diretos identificados pelo cliente')

      const result = lines.join('\n')
      setField('research_extra', result || 'Nenhuma informação encontrada. Verifique o CNPJ ou nome informado.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Erro na pesquisa: ${msg}`)
    }
    setResearchLoading(false)
  }

  const doSefaz = async () => {
    const raw = sefazCnpj.replace(/\D/g, '')
    if (raw.length !== 14) { alert('Informe um CNPJ com 14 dígitos.'); return }
    const cnpjFmt = raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    setSefazLoading(true); setSefazResult(null)
    try {
      // ── BrasilAPI CNPJ — gratuita, sem autenticação ──────
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`)
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}))
        throw new Error(errData?.message || `HTTP ${r.status}`)
      }
      const d = await r.json()

      // ── Simples Nacional ──────────────────────────────────
      let simplesOptante = 'Não identificado'
      let meiOptante = 'Não identificado'
      try {
        const rs = await fetch(`https://brasilapi.com.br/api/simples/v1/${raw}`)
        if (rs.ok) {
          const ds = await rs.json()
          simplesOptante = ds.simples?.optante ? 'Sim' : 'Não'
          meiOptante = ds.mei?.optante ? 'Sim' : 'Não'
        }
      } catch {}

      // ── Normaliza para o formato esperado pelo estado ─────
      const socios = (d.qsa || [])
        .map((s: Record<string,string>) => `${s.nome_socio} (${s.qualificacao_socio})`)
        .join('; ') || 'Não informado'

      // Infere regime tributário pelo porte/simples
      let regime = 'Não identificado'
      if (simplesOptante === 'Sim') regime = 'Simples Nacional'
      else if (d.porte === 'GRANDE') regime = 'Lucro Real'
      else if (['MEDIO', 'MÉDIO'].includes(d.porte)) regime = 'Lucro Presumido'

      // Infere documentos fiscais pelo CNAE
      const cnae = String(d.cnae_fiscal || '')
      const docsInferidos: string[] = ['NFC-e']
      if (cnae.startsWith('4') || cnae.startsWith('5')) docsInferidos.push('NF-e modelo 55')
      if (cnae.startsWith('49') || cnae.startsWith('53')) docsInferidos.push('CT-e','MDF-e')

      const result: Record<string, string> = {
        razao_social: d.razao_social || '—',
        nome_fantasia: d.nome_fantasia || '—',
        situacao_cadastral: d.descricao_situacao_cadastral || '—',
        porte: d.porte || '—',
        natureza_juridica: d.natureza_juridica || '—',
        capital_social: `R$ ${Number(d.capital_social || 0).toLocaleString('pt-BR')}`,
        atividade_principal_descricao: d.cnae_fiscal_descricao || '—',
        data_abertura: d.data_inicio_atividade || '—',
        municipio: d.municipio || '—',
        uf: d.uf || '—',
        email: d.email || '—',
        telefone: d.ddd_telefone_1 || '—',
        socios,
        simples_nacional: simplesOptante,
        mei: meiOptante,
        total_filiais: '1',
        regime_tributario: regime,
        contabilidade_tipo: d.porte === 'GRANDE' ? 'Interna' : 'Externa',
        possui_holding: 'Não identificado',
        documentos_fiscais_emitidos: docsInferidos.join(', '),
        operacoes_nf_modelo_55: cnae.startsWith('4') || cnae.startsWith('5') ? 'Venda' : 'Venda, Transferência',
      }

      setSefazResult(result)
      setField('cnpj', cnpjFmt)
      if (!fd['razao_social'] && result['razao_social'] !== '—') setField('razao_social', result['razao_social'])

      // ── Auto-fill campos do formulário ───────────────────

      // Nº CNPJs (BrasilAPI retorna estabelecimentos se disponível, senão 1)
      const totalEstab = d.estabelecimentos_inscritos || d.total_estabelecimentos || 1
      setField('qtd_cnpjs', String(totalEstab))

      // Regime tributário
      const REGIMES = ['Simples Nacional','Lucro Presumido','Lucro Real','Misto']
      const matchedRegime = REGIMES.filter(reg => result['regime_tributario'].includes(reg))
      if (matchedRegime.length) setField('regime', matchedRegime)

      // Contabilidade
      const contab = result['contabilidade_tipo']
      if (contab === 'Interna' || contab === 'Externa' || contab === 'Mista') setField('contabilidade', contab)

      // Holding — infere por natureza jurídica
      const natJur = String(d.natureza_juridica || '').toLowerCase()
      if (natJur.includes('holding') || natJur.includes('participa')) {
        setField('holding', 'Sim')
      } else if (natJur) {
        setField('holding', 'Não')
      }

      // Documentos fiscais
      const VALID_DOCS = ['NFC-e','NF-e modelo 55','MDF-e','CT-e']
      const matchedDocs = VALID_DOCS.filter(doc => result['documentos_fiscais_emitidos'].includes(doc))
      if (matchedDocs.length) setField('docs_fiscais', matchedDocs)

      // Operações NF modelo 55
      const VALID_OPS = ['Venda','Transferência','Industrialização','Produção própria','Marketplace']
      const matchedOps = VALID_OPS.filter(op => result['operacoes_nf_modelo_55'].includes(op))
      if (matchedOps.length) setField('ops_fiscais', matchedOps)

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`CNPJ não encontrado ou serviço indisponível.\nDetalhe: ${msg}`)
    }
    setSefazLoading(false)
  }

  const [checklistPdfLoading, setChecklistPdfLoading] = useState(false)

  const exportChecklistPDF = async () => {
    if (!def) return
    setChecklistPdfLoading(true)
    const client = String(fd['razao_social'] || 'Cliente')
    const date = new Date().toLocaleDateString('pt-BR')

    // ── 1. Monta contexto com campos preenchidos ──────────────
    let ctx = ''
    def.sections.forEach(s => {
      const filled = s.fields.filter(f => {
        const v = fd[f.id]
        return v && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione')
      })
      if (filled.length === 0) return
      ctx += `\n### ${s.title}\n`
      filled.forEach(f => {
        const v = fd[f.id]
        ctx += `- ${f.label}: ${Array.isArray(v) ? v.join(', ') : v}\n`
      })
    })

    // ── 2. Gera análise de riscos via Claude ──────────────────
    let analise = ''
    try {
      const prompt = `Você é um especialista em implantação de sistemas Teknisa para food service, indústrias e serviços de alimentação.

Com base nos dados do checklist abaixo, gere uma ANÁLISE DE RISCOS E PONTOS DE ATENÇÃO para a equipe de implantação. Seja direto, prático e específico.

CLIENTE: ${client}
CHECKLIST: ${def.label}
${ctx}

Estruture sua resposta em exatamente estas seções (use os títulos abaixo):

## CLASSIFICAÇÃO DE RISCO GERAL
[Uma linha: Baixo / Médio / Alto — com justificativa de 2-3 linhas baseada nos dados]

## RISCOS CRÍTICOS IDENTIFICADOS
[Liste de 3 a 6 riscos reais com base nos dados. Para cada um:
• Nome do risco
• Por que é um risco neste cliente
• Como mitigar]

## PONTOS DE ATENÇÃO TÉCNICA
[Liste de 3 a 5 pontos específicos para a equipe técnica de implantação, como: integrações críticas, configurações fiscais especiais, infraestrutura, volume de dados, customizações prometidas etc.]

## PONTOS DE ATENÇÃO OPERACIONAL
[Liste de 3 a 5 pontos para a equipe de treinamento e go-live: maturidade da equipe do cliente, processos não documentados, resistência esperada, dados a migrar, operações que não podem parar etc.]

## RECOMENDAÇÕES PARA O KICK-OFF
[3 a 5 ações concretas que o líder de implantação deve executar nas primeiras semanas]

## CHECKLIST DE VALIDAÇÃO PRÉ GO-LIVE
[Liste de 8 a 12 itens que devem ser validados antes da entrada em produção, específicos para este cliente]

Seja específico com os dados do cliente. Evite generalidades. Tom técnico e direto.`

      analise = await callClaude(prompt, false, 2000)
    } catch {
      analise = 'Não foi possível gerar a análise automática. Verifique sua conexão e a chave de API.'
    }

    // ── 3. Converte análise markdown → HTML simplificado ──────
    const analiseHtml = analise.split('\n').map(l => {
      if (/^## /.test(l)) return `<h2 class="sec-h2">${l.replace(/^## /,'')}</h2>`
      if (/^### /.test(l)) return `<h3 class="sec-h3">${l.replace(/^### /,'')}</h3>`
      if (/^[-•] /.test(l)) return `<div class="li">${l.replace(/^[-•] /,'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>`
      if (l.trim() === '') return '<div class="gap"></div>'
      return `<p>${l.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')}</p>`
    }).join('')

    // ── 4. Monta HTML dos campos preenchidos ──────────────────
    let fieldsHtml = ''
    def.sections.forEach(s => {
      const filled = s.fields.filter(f => {
        const v = fd[f.id]
        return v && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione')
      })
      if (filled.length === 0) return
      fieldsHtml += `<div class="section-block">
        <div class="section-title">${s.title}</div>
        <table class="fields-table">`
      filled.forEach(f => {
        const v = fd[f.id]
        const val = Array.isArray(v) ? v.join(', ') : String(v)
        fieldsHtml += `<tr><td class="field-label">${f.label}</td><td class="field-value">${val}</td></tr>`
      })
      fieldsHtml += `</table></div>`
    })

    // ── 5. Abre janela de impressão ───────────────────────────
    const w = window.open('', '_blank')
    if (!w) { setChecklistPdfLoading(false); return }

    const risco = String(fd['risco'] || '—')
    const riscoColor = risco === 'Alto' ? '#c0392b' : risco === 'Médio' ? '#e67e22' : '#27ae60'

    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Checklist — ${client}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Roboto',Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff;line-height:1.5;}
.wrap{max-width:820px;margin:0 auto;padding:32px 40px 60px;}

/* CAPA */
.cover{background:linear-gradient(135deg,#030268,#040486);color:#fff;padding:40px;border-radius:12px;margin-bottom:32px;page-break-inside:avoid;}
.cover-logo{font-family:'Poppins',sans-serif;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;opacity:.7;margin-bottom:24px;}
.cover-title{font-family:'Poppins',sans-serif;font-size:26px;font-weight:800;line-height:1.2;margin-bottom:6px;}
.cover-sub{font-size:13px;opacity:.7;margin-bottom:24px;}
.cover-meta{display:flex;gap:24px;flex-wrap:wrap;}
.cover-field{display:flex;flex-direction:column;gap:2px;}
.cover-field-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;opacity:.5;}
.cover-field-value{font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;}
.risco-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);}

/* SEPARADOR DE PARTES */
.part-header{font-family:'Poppins',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#040486;border-bottom:2px solid #040486;padding-bottom:8px;margin:32px 0 20px;}

/* CAMPOS DO CHECKLIST */
.section-block{margin-bottom:20px;page-break-inside:avoid;}
.section-title{font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#555;background:#f5f5f8;padding:6px 10px;border-left:3px solid #040486;margin-bottom:0;}
.fields-table{width:100%;border-collapse:collapse;}
.fields-table tr{border-bottom:1px solid #eee;}
.fields-table tr:last-child{border-bottom:none;}
.field-label{width:42%;padding:7px 10px;font-size:11px;color:#666;vertical-align:top;font-weight:500;}
.field-value{width:58%;padding:7px 10px;font-size:11px;color:#1a1a2e;vertical-align:top;font-weight:400;}

/* ANÁLISE DE RISCOS */
.sec-h2{font-family:'Poppins',sans-serif;font-size:12px;font-weight:700;color:#030268;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;padding:8px 12px;background:#f0f0fa;border-left:4px solid #040486;}
.sec-h3{font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:.8px;margin:12px 0 5px;}
.li{display:flex;gap:8px;padding:3px 0;font-size:11.5px;color:#333;line-height:1.6;}
.li::before{content:'›';color:#040486;flex-shrink:0;font-weight:900;font-size:13px;margin-top:1px;}
.gap{height:6px;}
p{font-size:11.5px;color:#333;line-height:1.65;margin-bottom:5px;}
strong{color:#1a1a2e;font-weight:700;}

/* RODAPÉ */
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#aaa;}
@media print{
  .section-block{page-break-inside:avoid;}
  .sec-h2{page-break-after:avoid;}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
</style>
</head>
<body>
<div class="wrap">

  <!-- CAPA -->
  <div class="cover">
    <div class="cover-logo">TEKNISA · Intelligence Comercial</div>
    <div class="cover-title">Checklist Comercial<br>de Implantação</div>
    <div class="cover-sub">${def.label}</div>
    <div class="cover-meta">
      <div class="cover-field"><span class="cover-field-label">Cliente</span><span class="cover-field-value">${client}</span></div>
      <div class="cover-field"><span class="cover-field-label">Data</span><span class="cover-field-value">${date}</span></div>
      <div class="cover-field"><span class="cover-field-label">Preenchimento</span><span class="cover-field-value">${pct}%</span></div>
      <div class="cover-field"><span class="cover-field-label">Risco Global</span><span class="cover-field-value"><span class="risco-badge" style="color:${riscoColor}">${risco}</span></span></div>
    </div>
  </div>

  <!-- PARTE 1: CAMPOS PREENCHIDOS -->
  <div class="part-header">Parte 1 — Dados do Checklist Preenchido</div>
  ${fieldsHtml || '<p style="color:#999">Nenhum campo preenchido.</p>'}

  <!-- PARTE 2: ANÁLISE DE RISCOS -->
  <div class="part-header">Parte 2 — Análise de Riscos e Pontos de Atenção para Implantação</div>
  ${analiseHtml}

  <div class="footer">
    <span>Teknisa — Intelligence Comercial · Checklist de Implantação</span>
    <span>${client} · ${date}</span>
  </div>

</div>
<script>setTimeout(()=>window.print(),800);<\/script>
</body>
</html>`)
    w.document.close()
    setChecklistPdfLoading(false)
  }

  const generateReport = async () => {
    if (!def) return
    setPage('report'); setLoading(true); setReportHtml(''); setReportMd('')
    const client = String(fd['razao_social'] || 'Cliente')
    let ctx = `TIPO: ${def.label}\n\n`
    def.sections.forEach(s => {
      ctx += `### ${s.title}\n`
      s.fields.forEach(f => {
        const v = fd[f.id]
        if (v && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '' && v !== 'Selecione'))
          ctx += `- ${f.label}: ${Array.isArray(v) ? v.join(', ') : v}\n`
      })
      ctx += '\n'
    })
    const prompt = `Você é o Diretor Comercial Sênior da Teknisa — empresa líder em software de gestão para food service, indústrias de alimentos e serviços de nutrição.\nGere um RELATÓRIO COMERCIAL ESTRATÉGICO completo, profundo e acionável sobre este cliente. Use o nome "${client}" em todo o relatório. Seja específico com os dados. Escreva em português, tom executivo direto.\n\nDADOS DO CLIENTE:\n${ctx}\n\nESTRUTURA OBRIGATÓRIA (use ## para seções e ### para subseções):\n\n## RELATÓRIO COMERCIAL ESTRATÉGICO — ${client}\n[Subtítulo de 1 linha]\nCliente: ${client} | Segmento: [dados] | Unidades: [dados] | Faturamento: [dados] | ERP atual: [dados]\n[Parágrafo introdutório 3-4 linhas]\n---\n## 1. LEITURA EXECUTIVA DA CONTA\n### Classificação da Oportunidade\n[Tier 1/2/3 com justificativa. Missão da Teknisa nesta conta.]\n### Fit Estratégico Teknisa\n[8-10 pontos com ✅ específicos para este cliente]\n---\n## 2. DIAGNÓSTICO COMERCIAL DA CONTA\n### Situação Atual\n[Sistema atual, dores, satisfação percebida.]\n### Risco Silencioso\n[Maior risco direto e específico.]\n### Leitura Política do Cliente\n[Exigência, sofisticação, o que realmente compra, impacto de falha]\n---\n## 3. DIAGNÓSTICO DE MATURIDADE OPERACIONAL\n### Maturidade: [ALTA/MÉDIA/BAIXA]\n[Justificativa + o erro que Teknisa não deve cometer]\n### Mensagem comercial ideal:\n> "[Pitch ideal específico para este cliente]"\n---\n## 4. ARQUITETURA DE OPORTUNIDADE TEKNISA\n### O que provavelmente já existe\n[Lista atual]\n### O que deve ser expandido\n[Mínimo 5 oportunidades com: nome, prioridade, tese, módulos, valor percebido]\n---\n## 5. RISCOS REAIS DA CONTA\n[Riscos de concorrência (onde ameaça / onde Teknisa ganha) + outros riscos]\n---\n## 6. RECOMENDAÇÃO COMERCIAL\n**[PRIMEIRA AÇÃO PRIORITÁRIA EM MAIÚSCULAS]**\n### Programa ${client} Excellence\n[3-4 frentes com objetivo e KPIs]\n**Roadmap por ondas:** Wave 1: [nome] | Wave 2: [nome] | Wave 3: [nome] | Wave 4: [nome] | Wave 5: [nome]\n---\n## 7. TESE COMERCIAL\n> "[Pitch ERRADO]"\n> "[Pitch CORRETO e poderoso]"\n---\n## 8. PARECER FINAL DO DIRETOR COMERCIAL\nPotencial: [classificação] | Complexidade: [classificação] | Risco: [classificação] | Expansão: [faixa]\n[Se bem conduzida: lista] [Se mal conduzida: consequência]\n**Conclusão executiva:** [O ${client} não é uma venda. É uma _____.]\n---\nSeja extremamente específico. Use os dados do cliente. Tom de Diretor Comercial experiente.`
    try {
      const text = await callClaude(prompt, false, 4000)
      setReportMd(text)
      setReportHtml(mdToHtml(text))
    } catch { setReportHtml('<p style="color:#e84d4d">Erro ao gerar relatório. Tente novamente.</p>') }
    setLoading(false)
  }

  const copyReport = () => { navigator.clipboard.writeText(reportMd); alert('Relatório copiado!') }

  const exportPDF = () => {
    const client = String(fd['razao_social'] || 'Relatorio')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório — ${client}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Roboto',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;}.wrap{max-width:800px;margin:0 auto;padding:40px 50px 60px;}.rs{margin-bottom:22px;page-break-inside:avoid;}.rs-ttl{font-size:9px;font-family:'Poppins',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#aaa;margin-bottom:11px;display:flex;align-items:center;gap:8px;}.rs-ttl::after{content:'';flex:1;height:1px;background:#e0e0e0;}.rs-body{font-size:12.5px;color:#333;line-height:1.85;}.rs-body strong{color:#1a1a2e;}.rs-body h3{font-size:9px;font-family:'Poppins',sans-serif;font-weight:700;color:#030268;text-transform:uppercase;letter-spacing:1.2px;margin:14px 0 6px;padding-left:8px;border-left:3px solid #F4B800;}.rs-body ul{list-style:none;display:flex;flex-direction:column;gap:3px;padding-left:3px;margin:5px 0 9px;}.rs-body li{display:flex;gap:8px;line-height:1.6;}.rs-body li::before{content:'›';color:#059E1E;flex-shrink:0;font-weight:900;}.rs-body blockquote{border-left:3px solid #F4B800;padding:9px 15px;background:#fdf9f0;border-radius:0 6px 6px 0;margin:11px 0;color:#1a1a2e;font-style:italic;font-size:13px;}.rs-body p{margin-bottom:7px;}.rs-body em{color:#b07d1a;font-style:normal;font-weight:600;}.footer{margin-top:36px;padding-top:14px;border-top:1px solid #e0e0e0;font-family:'Roboto',sans-serif;font-size:9px;color:#aaa;display:flex;justify-content:space-between;}@media print{.rs{page-break-inside:avoid;}}</style></head><body><div class="wrap">${reportHtml}<div class="footer"><span>Teknisa — Intelligence Comercial</span><span>${new Date().toLocaleDateString('pt-BR')}</span></div></div><script>setTimeout(()=>window.print(),600);<\/script></body></html>`)
    w.document.close()
    setExportOpen(false)
  }

  // ── field renderer ────────────────────────────────────────
  const renderField = (f: Field) => {
    const v = fd[f.id]
    const vs = Array.isArray(v) ? '' : String(v || '')
    const vArr = Array.isArray(v) ? v : []

    if (f.type === 'text' || f.type === 'number') return (
      <div key={f.id} className="fgrp">
        <label className="lbl">{f.label}</label>
        <input type={f.type} value={vs} placeholder={f.ph} onChange={e => setField(f.id, e.target.value)} />
      </div>
    )
    if (f.type === 'textarea') return (
      <div key={f.id} className="fgrp s2">
        <label className="lbl">{f.label}</label>
        <textarea value={vs} placeholder={f.ph} onChange={e => setField(f.id, e.target.value)} />
      </div>
    )
    if (f.type === 'select') return (
      <div key={f.id} className="fgrp">
        <label className="lbl">{f.label}</label>
        <select value={vs || 'Selecione'} onChange={e => setField(f.id, e.target.value)}>
          {f.opts?.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    )
    if (f.type === 'chips') return (
      <div key={f.id} className="fgrp s2">
        <label className="lbl">{f.label}</label>
        <div className="chips-grp">
          {f.opts?.map(o => <span key={o} className={`chip${vArr.includes(o) ? ' on' : ''}`} onClick={() => toggleChip(f.id, o)}>{o}</span>)}
        </div>
      </div>
    )
    if (f.type === 'radio') return (
      <div key={f.id} className="fgrp s2">
        <label className="lbl">{f.label}</label>
        <div className="radio-grp">
          {f.opts?.map(o => <span key={o} className={`radio-opt${vs === o ? ' on' : ''}`} onClick={() => setField(f.id, o)}>{o}</span>)}
        </div>
      </div>
    )
    if (f.type === 'radio_conditional') {
      const triggers = (f.conditionalOpt || '').split('|')
      const isTrig = triggers.includes(vs)
      const cf = f.conditionalField!
      const cfv = String(fd[cf.id] || '')
      return (
        <div key={f.id} className="fgrp s2">
          <label className="lbl">{f.label}</label>
          <div className="radio-grp">
            {f.opts?.map(o => <span key={o} className={`radio-opt${vs === o ? ' on' : ''}`} onClick={() => setField(f.id, o)}>{o}</span>)}
          </div>
          {isTrig && (
            <div style={{ marginTop: 10 }}>
              <label className="lbl" style={{ marginBottom: 5, display: 'block' }}>{cf.label}</label>
              {cf.type === 'pdf_upload' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ background: 'var(--tk-primary)', border: '1px solid var(--tk-yellow)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', fontSize: 11, fontWeight: 600, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    📎 Selecionar PDF
                    <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) { setField(cf.id + '_name', file.name); const r = new FileReader(); r.onload = ev => setField(cf.id, String(ev.target?.result)); r.readAsDataURL(file) } }} />
                  </label>
                  <span style={{ fontSize: 11, color: fd[cf.id + '_name'] ? 'var(--tk-green)' : 'rgba(255,255,255,.3)' }}>{fd[cf.id + '_name'] ? `✅ ${fd[cf.id + '_name']}` : 'Nenhum arquivo selecionado'}</span>
                </div>
              ) : (
                <input type="text" value={cfv} placeholder={cf.ph} onChange={e => setField(cf.id, e.target.value)} />
              )}
            </div>
          )}
        </div>
      )
    }
    if (f.type === 'regime_dynamic') {
      const qtd = parseInt(String(fd['qtd_cnpjs'] || '1')) || 1
      const REGIMES = ['Simples Nacional','Lucro Presumido','Lucro Real','Misto']
      return (
        <div key={f.id} className="fgrp s2">
          <label className="lbl">{f.label} {qtd > 1 ? <span style={{ color: 'var(--tk-yellow)', fontSize: 9, fontWeight: 500 }}>({qtd} CNPJs — selecione todos os regimes aplicáveis)</span> : <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 9 }}>(selecione o regime)</span>}</label>
          <div className="chips-grp">
            {REGIMES.map(o => <span key={o} className={`chip${vArr.includes(o) ? ' on' : ''}`} onClick={() => toggleChip(f.id, o)}>{o}</span>)}
          </div>
        </div>
      )
    }
    if (f.type === 'risk' || f.type === 'risk_tooltip') {
      const rv = String(fd['risco'] || '')
      const tips: Record<string,string> = {
        'Baixo': '🟢 BAIXO — Cliente com processos maduros, infraestrutura adequada, escopo claro, equipe engajada e expectativas alinhadas com o produto. Implantação tende a ser fluida.',
        'Médio': '🟡 MÉDIO — Cliente com alguma complexidade operacional, processos parcialmente definidos ou expectativas que demandam atenção extra. Requer acompanhamento próximo durante implantação.',
        'Alto': '🔴 ALTO — Operação complexa, sem processos definidos, infraestrutura deficiente, alta expectativa vs. realidade, dependência de terceiros ou promessas fora do escopo. Implantação exige plano de mitigação e acompanhamento sênior.',
      }
      return (
        <div key={f.id} className="fgrp s2">
          <label className="lbl">Classificação de Risco Global</label>
          <div className="risk-row">
            {(['Baixo','Médio','Alto'] as const).map(r => (
              <div key={r} className={`risk-opt r-${r === 'Baixo' ? 'low' : r === 'Médio' ? 'med' : 'high'}${rv === r ? ' on' : ''}`}
                onClick={() => setField('risco', r)}
                onMouseEnter={() => setTooltipText(tips[r])}
                onMouseLeave={() => setTooltipText('')}
              >{r === 'Baixo' ? '🟢' : r === 'Médio' ? '🟡' : '🔴'} {r}</div>
            ))}
          </div>
          {tooltipText && <div style={{ marginTop: 9, padding: '9px 13px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,.72)', lineHeight: 1.6, fontFamily: 'Roboto,sans-serif' }}>{tooltipText}</div>}
        </div>
      )
    }
    return null
  }

  // ── styles ────────────────────────────────────────────────
  // ── styles ────────────────────────────────────────────────
  const css = `
:root{--tk-primary:#040486;--tk-deep:#03004F;--tk-blue:#0800B7;--tk-green:#059E1E;--tk-yellow:#F4B800;--bg:#02013a;--radius:8px;--radius-lg:12px;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#__next{height:100%;}
body{font-family:'Roboto',sans-serif;font-size:14px;color:#fff;background:var(--bg);overflow:hidden;}
.topbar{position:fixed;top:0;left:0;right:0;z-index:200;background:var(--tk-deep);border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:54px;gap:8px;}
.tk-wordmark{font-family:'Poppins',sans-serif;font-size:15px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;}
.tk-dots{display:flex;gap:3px;align-items:center;}
.tk-dot{width:5px;height:5px;border-radius:50%;}
.tk-sub{font-family:'Roboto',sans-serif;font-size:8px;color:rgba(255,255,255,.45);letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;}
.tab-ctr{display:flex;align-items:center;gap:2px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:3px;flex-shrink:0;}
.tab-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;font-family:'Roboto',sans-serif;font-size:11px;font-weight:500;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,.5);transition:all .18s;white-space:nowrap;}
.tab-btn:hover{color:#fff;}
.tab-btn.active{background:var(--tk-primary);color:#fff;box-shadow:0 2px 8px rgba(4,4,134,.5);}
.tab-btn.has-report{color:var(--tk-yellow);}
.tab-dot-ind{width:5px;height:5px;border-radius:50%;background:var(--tk-green);}
.hdr-client{font-size:10px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
.hdr-client strong{color:rgba(255,255,255,.85);}
.status-pill{display:flex;align-items:center;gap:5px;font-size:9px;color:rgba(255,255,255,.45);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:3px 9px;white-space:nowrap;}
.sdot{width:4px;height:4px;border-radius:50%;background:var(--tk-green);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
.layout{position:fixed;top:54px;left:0;right:0;bottom:0;display:flex;flex-direction:row;}
.sidebar{width:240px;flex-shrink:0;background:var(--tk-deep);border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;overflow-y:auto;height:100%;transition:transform .25s ease,box-shadow .25s ease;}
.sb-sec{padding:14px 12px 0;}
.sb-lbl{font-family:'Poppins',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.3);margin-bottom:8px;}
.cl-sel{display:flex;flex-direction:column;gap:4px;}
.cl-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);padding:9px 11px;cursor:pointer;text-align:left;color:rgba(255,255,255,.6);transition:all .18s;display:flex;align-items:center;gap:8px;width:100%;}
.cl-btn:hover{border-color:rgba(255,255,255,.3);color:#fff;}
.cl-btn.active{border-color:var(--tk-yellow);background:rgba(244,184,0,.1);color:#fff;}
.cl-btn.active .cl-name{color:var(--tk-yellow);}
.cl-icon{font-size:15px;flex-shrink:0;}.cl-info{flex:1;min-width:0;}
.cl-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:11px;display:block;}
.cl-desc{font-size:10px;opacity:.6;display:block;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-div{border:none;border-top:1px solid rgba(255,255,255,.08);margin:10px 0;}
.prog-area{padding:0 12px 12px;}
.prog-lbl{font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:6px;display:flex;justify-content:space-between;}
.prog-bar{height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--tk-yellow),var(--tk-green));border-radius:2px;transition:width .35s;}
.sec-nav{display:flex;flex-direction:column;gap:1px;padding:0 6px 12px;}
.nav-it{padding:6px 8px;border-radius:var(--radius);cursor:pointer;color:rgba(255,255,255,.45);font-size:11px;transition:all .14s;display:flex;align-items:center;gap:6px;user-select:none;}
.nav-it:hover{background:rgba(255,255,255,.07);color:#fff;}
.nav-it.active{background:rgba(4,4,134,.6);color:#fff;border-left:2px solid var(--tk-yellow);}
.nav-num{font-size:9px;font-weight:500;color:rgba(255,255,255,.22);min-width:16px;}
.nav-ck{margin-left:auto;font-size:9px;color:var(--tk-green);}
.main{flex:1;overflow-y:auto;background:var(--bg);}
.form-area{padding:20px 24px;max-width:860px;width:100%;}
.sec-hdr{margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08);}
.sec-num{font-size:9px;font-weight:500;color:rgba(255,255,255,.28);letter-spacing:2.5px;text-transform:uppercase;}
.sec-ttl{font-family:'Poppins',sans-serif;font-size:20px;font-weight:700;color:#fff;margin:3px 0 5px;line-height:1.25;}
.sec-dsc{color:rgba(255,255,255,.5);font-size:12px;line-height:1.6;}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.fgrp{display:flex;flex-direction:column;gap:4px;}
.fgrp.s2{grid-column:span 2;}
label.lbl{font-family:'Poppins',sans-serif;font-size:9px;font-weight:600;color:rgba(255,255,255,.45);letter-spacing:.8px;text-transform:uppercase;}
input[type=text],input[type=number],select,textarea{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);color:#fff;font-family:'Roboto',sans-serif;font-size:13px;padding:9px 12px;width:100%;transition:border-color .18s,background .18s;outline:none;-webkit-appearance:none;appearance:none;}
input[type=text]:focus,input[type=number]:focus,select:focus,textarea:focus{border-color:var(--tk-yellow);background:rgba(244,184,0,.05);}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.18);}
textarea{resize:vertical;min-height:72px;line-height:1.6;}
select option{background:#03004F;color:#fff;}
.res-banner{background:rgba(0,81,208,.15);border:1px solid rgba(0,81,208,.35);border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:9px;}
.rb-icon{font-size:16px;margin-top:1px;flex-shrink:0;}
.rb-txt{font-size:12px;color:rgba(255,255,255,.6);line-height:1.65;}
.rb-txt strong{color:#fff;font-weight:700;}
.res-btn{margin-top:8px;background:rgba(0,81,208,.25);border:1px solid rgba(0,81,208,.5);border-radius:6px;color:#fff;font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;touch-action:manipulation;}
.res-btn:hover{background:rgba(0,81,208,.45);}
.res-btn:disabled{opacity:.5;cursor:not-allowed;}
.res-btn.yellow{border-color:rgba(244,184,0,.5);color:var(--tk-yellow);}
.res-btn.yellow:hover{background:rgba(244,184,0,.15);}
.chips-grp{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}
.chip{display:inline-flex;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:6px 13px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.55);transition:all .14s;user-select:none;touch-action:manipulation;}
.chip:hover{border-color:rgba(255,255,255,.35);color:#fff;}
.chip.on{background:rgba(244,184,0,.14);border-color:var(--tk-yellow);color:var(--tk-yellow);font-weight:500;}
.radio-grp{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}
.radio-opt{display:inline-flex;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:8px 14px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.55);transition:all .14s;user-select:none;touch-action:manipulation;}
.radio-opt:hover{border-color:rgba(255,255,255,.32);color:#fff;}
.radio-opt.on{background:rgba(4,4,134,.5);border-color:rgba(8,0,183,.8);color:#fff;font-weight:500;}
.risk-row{display:flex;gap:7px;margin-top:4px;}
.risk-opt{flex:1;padding:10px 8px;border-radius:var(--radius);border:1px solid rgba(255,255,255,.14);text-align:center;cursor:pointer;font-family:'Poppins',sans-serif;font-size:12px;font-weight:600;transition:all .14s;user-select:none;touch-action:manipulation;color:rgba(255,255,255,.45);}
.r-low.on{background:rgba(5,158,30,.15);border-color:var(--tk-green);color:var(--tk-green);}
.r-med.on{background:rgba(244,184,0,.15);border-color:var(--tk-yellow);color:var(--tk-yellow);}
.r-high.on{background:rgba(232,77,77,.15);border-color:#e84d4d;color:#e84d4d;}
.form-nav{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);}
.btn{padding:10px 20px;border-radius:var(--radius);font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;border:none;display:inline-flex;align-items:center;gap:6px;touch-action:manipulation;}
.btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.5);}
.btn-ghost:hover{border-color:rgba(255,255,255,.5);color:#fff;}
.btn-ghost:disabled{opacity:.25;cursor:not-allowed;}
.btn-pri{background:var(--tk-primary);color:#fff;border:1px solid transparent;}
.btn-pri:hover{background:var(--tk-blue);}
.btn-gen{background:var(--tk-primary);border:2px solid var(--tk-yellow);color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:var(--radius-lg);}
.btn-gen:hover{background:var(--tk-blue);}
.intro{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;}
.intro-ttl{font-family:'Poppins',sans-serif;font-size:24px;font-weight:800;color:#fff;margin-bottom:10px;line-height:1.2;}
.intro-ttl span{color:var(--tk-yellow);}
.intro-dsc{color:rgba(255,255,255,.5);font-size:13px;line-height:1.7;max-width:460px;margin-bottom:22px;}
.intro-cards{display:flex;gap:9px;width:100%;max-width:500px;}
.ic{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-lg);padding:13px;flex:1;text-align:left;}
.ic-icon{font-size:20px;margin-bottom:6px;}
.ic-ttl{font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;color:#fff;margin-bottom:3px;}
.ic-dsc{font-size:10px;color:rgba(255,255,255,.45);line-height:1.5;}
.mob-menu-btn{display:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:18px;padding:5px 9px;cursor:pointer;flex-shrink:0;touch-action:manipulation;line-height:1;}
.mob-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;top:54px;cursor:pointer;}
/* REPORT */
.report-layout{position:fixed;top:54px;left:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--bg);}
.rpt-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:14px;}
.loader-ring{width:32px;height:32px;border:2px solid rgba(255,255,255,.1);border-top-color:var(--tk-yellow);border-radius:50%;animation:spin .75s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.loader-msg{font-size:10px;color:rgba(255,255,255,.4);text-align:center;line-height:1.8;}
.rpt-bar{flex-shrink:0;background:var(--tk-deep);border-bottom:1px solid rgba(255,255,255,.08);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.rpt-client-name{font-family:'Poppins',sans-serif;font-size:14px;font-weight:700;color:#fff;}
.rpt-meta{font-size:9px;color:rgba(255,255,255,.35);}
.rpt-bar-right{display:flex;gap:7px;align-items:center;position:relative;flex-wrap:wrap;}
.btn-rpt{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:var(--radius);font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.55);touch-action:manipulation;}
.btn-rpt:hover{border-color:rgba(255,255,255,.4);color:#fff;}
.btn-export{background:rgba(244,184,0,.12);border:1px solid rgba(244,184,0,.4);color:var(--tk-yellow);}
.btn-export:hover{background:rgba(244,184,0,.22);}
.export-menu{position:absolute;top:calc(100% + 5px);right:0;background:var(--tk-deep);border:1px solid rgba(255,255,255,.15);border-radius:var(--radius-lg);padding:5px;min-width:190px;z-index:100;box-shadow:0 12px 40px rgba(0,0,0,.5);}
.export-item{display:flex;align-items:center;gap:9px;padding:10px;border-radius:var(--radius);cursor:pointer;touch-action:manipulation;}
.export-item:hover{background:rgba(255,255,255,.08);}
.export-item .ei-icon{font-size:15px;}
.export-item .ei-label{font-family:'Poppins',sans-serif;font-size:12px;font-weight:600;color:#fff;}
.export-item .ei-sub{font-size:9px;color:rgba(255,255,255,.35);}
.export-div{border:none;border-top:1px solid rgba(255,255,255,.08);margin:3px 0;}
.rpt-scroll{flex:1;overflow-y:auto;}
.rpt-inner{max-width:820px;margin:0 auto;padding:20px 16px 80px;}
.rc-banner{background:linear-gradient(135deg,var(--tk-primary),var(--tk-deep));border:1px solid rgba(244,184,0,.3);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;}
.rc-name{font-family:'Poppins',sans-serif;font-size:22px;font-weight:800;color:#fff;line-height:1.15;}
.rc-sub{font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;line-height:1.7;}
.rc-tier{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-family:'Poppins',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;background:rgba(244,184,0,.18);color:var(--tk-yellow);border:1px solid rgba(244,184,0,.35);}
.rc-stats{display:flex;gap:8px;flex-wrap:wrap;}
.rc-stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:10px 14px;text-align:center;min-width:72px;}
.rc-stat-val{font-family:'Poppins',sans-serif;font-size:16px;font-weight:700;color:var(--tk-yellow);line-height:1;}
.rc-stat-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.35);margin-top:3px;}
.rs{margin-bottom:20px;}
.rs-ttl{font-family:'Poppins',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:rgba(255,255,255,.3);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.rs-ttl::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08);}
.rs-body{font-size:13px;color:rgba(255,255,255,.68);line-height:1.85;}
.rs-body strong{color:#fff;}
.rs-body h3{font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.88);text-transform:uppercase;letter-spacing:1.2px;margin:14px 0 6px;padding-left:9px;border-left:3px solid var(--tk-yellow);}
.rs-body ul{list-style:none;display:flex;flex-direction:column;gap:3px;padding-left:3px;margin:5px 0 9px;}
.rs-body li{display:flex;gap:9px;line-height:1.6;}
.rs-body li::before{content:'›';color:var(--tk-green);flex-shrink:0;margin-top:2px;font-weight:900;font-size:13px;}
.rs-body blockquote{border-left:3px solid var(--tk-yellow);padding:10px 14px;background:rgba(244,184,0,.06);border-radius:0 var(--radius) var(--radius) 0;margin:10px 0;color:#fff;font-size:13px;line-height:1.72;font-style:italic;font-weight:500;}
.rs-body p{margin-bottom:7px;}
.rs-body em{color:var(--tk-yellow);font-style:normal;font-weight:600;}
.rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;text-align:center;padding:24px;}
.rp-empty .big-ic{font-size:46px;opacity:.2;}
.rp-empty p{color:rgba(255,255,255,.4);font-size:13px;max-width:280px;line-height:1.7;}
.rp-empty .hint{font-size:10px;color:rgba(255,255,255,.25);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:7px 14px;border-radius:var(--radius);}
.sefaz-result-row{display:flex;gap:9px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:baseline;flex-wrap:wrap;}
.sefaz-result-key{min-width:130px;flex-shrink:0;font-size:9px;font-family:'Poppins',sans-serif;font-weight:600;color:rgba(255,255,255,.32);text-transform:uppercase;letter-spacing:.7px;}
.sefaz-result-val{color:#fff;font-size:11px;line-height:1.5;flex:1;}
/* ══ MOBILE ≤768px ══ */
@media(max-width:768px){
  body{overflow:auto;}
  .topbar{padding:0 10px;height:50px;}
  .tk-sub{display:none;}
  .hdr-client{display:none;}
  .status-pill{display:none;}
  .mob-menu-btn{display:flex;}
  .layout{position:relative;top:0;flex-direction:column;min-height:calc(100vh - 50px);margin-top:50px;}
  .sidebar{position:fixed;top:50px;left:0;bottom:0;width:280px;z-index:160;transform:translateX(-100%);box-shadow:4px 0 24px rgba(0,0,0,.5);}
  .sidebar.open{transform:translateX(0);}
  .mob-overlay.open{display:block;}
  .main{flex:1;overflow-y:visible;min-height:calc(100vh - 50px);}
  .form-area{padding:16px 14px 100px;}
  .fg{grid-template-columns:1fr;gap:10px;}
  .fgrp.s2{grid-column:span 1;}
  .sec-ttl{font-size:18px;}
  input[type=text],input[type=number],select,textarea{font-size:16px;padding:11px 12px;}
  .chip{padding:8px 14px;font-size:13px;}
  .radio-opt{padding:10px 14px;font-size:13px;}
  .res-banner{flex-direction:column;gap:8px;}
  .intro{padding:20px 16px;justify-content:flex-start;padding-top:32px;}
  .intro-ttl{font-size:20px;}
  .intro-cards{flex-direction:column;}
  .ic{flex:none;}
  .report-layout{position:relative;top:0;margin-top:50px;min-height:calc(100vh - 50px);}
  .rpt-bar{padding:10px 14px;}
  .rpt-inner{padding:16px 14px 80px;}
  .rc-banner{flex-direction:column;gap:12px;}
  .rc-stats{width:100%;}
  .rc-stat{flex:1;}
  .form-nav{position:fixed;bottom:0;left:0;right:0;background:var(--tk-deep);border-top:1px solid rgba(255,255,255,.1);padding:12px 16px;margin:0;z-index:140;box-shadow:0 -4px 20px rgba(0,0,0,.3);}
  .btn{padding:12px 20px;font-size:13px;}
  .btn-gen{padding:12px 20px;font-size:13px;}
  .tab-btn{padding:5px 8px;font-size:10px;}
}
@media(max-width:400px){
  .tk-wordmark{font-size:12px;letter-spacing:1px;}
  .tab-btn{padding:4px 7px;font-size:9px;}
  .sec-ttl{font-size:16px;}
  .btn-gen{font-size:12px;padding:11px 14px;}
}`


  const tier = (() => {
    const mat = String(fd['maturidade'] || '')
    const fat = String(fd['fat_rede'] || fd['fat_total'] || fd['fat_mensal'] || '').toLowerCase()
    const units = parseInt(String(fd['qtd_unidades'] || fd['contratos'] || '0')) || 0
    if (mat === 'Alta' || units >= 50 || fat.includes('bilh') || fat.includes('500') || fat.includes('300')) return '⭐ Tier 1 — Enterprise Strategic'
    if (mat === 'Média' || units >= 10) return 'Tier 2 — Commercial Account'
    return 'Tier 3 — Standard Account'
  })()

  const SEFAZ_LABELS: Record<string,string> = { razao_social:'Razão Social',nome_fantasia:'Nome Fantasia',situacao_cadastral:'Situação Cadastral',porte:'Porte',natureza_juridica:'Natureza Jurídica',capital_social:'Capital Social',atividade_principal_descricao:'Atividade Principal',data_abertura:'Data de Abertura',municipio:'Município',uf:'UF',email:'E-mail',telefone:'Telefone',socios:'Quadro Societário',simples_nacional:'Simples Nacional',total_filiais:'Total CNPJs/Filiais',regime_tributario:'Regime Tributário',contabilidade_tipo:'Contabilidade',possui_holding:'Holding',documentos_fiscais_emitidos:'Documentos Fiscais',operacoes_nf_modelo_55:'Operações NF 55' }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* TOPBAR */}
      <header className="topbar">
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div className="tk-wordmark">TEKNISA</div>
          <div className="tk-dots">
            <span className="tk-dot" style={{ background:'#fff' }} />
            <span className="tk-dot" style={{ background:'#059E1E' }} />
            <span className="tk-dot" style={{ background:'#fff' }} />
            <span className="tk-dot" style={{ background:'#F4B800' }} />
          </div>
          <span className="tk-sub">Intelligence Comercial</span>
        </div>
        <div className="tab-ctr">
          <button className={`tab-btn${page==='checklist'?' active':''}`} onClick={() => setPage('checklist')}>📋 Checklist</button>
          <button className={`tab-btn${page==='report'?' active':''}${reportHtml?' has-report':''}`} onClick={() => setPage('report')}>
            {reportHtml && <span className="tab-dot-ind" />}
            📊 Relatório
          </button>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div className="hdr-client">Cliente: <strong>{clientName}</strong></div>
          <div className="status-pill"><span className="sdot" />Sistema Ativo</div>
          <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">☰</button>
        </div>
      </header>

      {/* CHECKLIST PAGE */}
      {page === 'checklist' && (
        <div className="layout">
          {/* sidebar */}
          {/* overlay mobile */}
      <div className={`mob-overlay${sidebarOpen?' open':''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen?' open':''}`}>
            <div className="sb-sec">
              <div className="sb-lbl">Tipo de Checklist</div>
              <div className="cl-sel">
                {Object.entries(DEFS).map(([key, d]) => (
                  <button key={key} className={`cl-btn${cl===key?' active':''}`} onClick={() => {
                    // Salva dados do checklist atual antes de trocar
                    if (cl && cl !== key) {
                      try {
                        const fdSafe = Object.fromEntries(Object.entries(fd).filter(([k,v]) => !k.endsWith('_upload') && !(typeof v === 'string' && v.startsWith('data:'))))
                        localStorage.setItem(`tk_fd_${cl}`, JSON.stringify(fdSafe))
                      } catch {}
                    }
                    // Restaura dados do checklist selecionado (se existirem)
                    try {
                      const saved = localStorage.getItem(`tk_fd_${key}`)
                      setFd(saved ? JSON.parse(saved) : {})
                    } catch { setFd({}) }
                    const savedSec = parseInt(localStorage.getItem(`tk_sec_${key}`) || '0') || 0
                    setCl(key); setSec(savedSec); setSidebarOpen(false); setSefazResult(null); setSefazCnpj('')
                  }}>
                    <span className="cl-icon">{key==='retail'?'🍔':key==='erp'?'🏭':'🍽️'}</span>
                    <span className="cl-info"><span className="cl-name">{d.label}</span><span className="cl-desc">{key==='retail'?'Restaurantes, Redes, Franquias':key==='erp'?'Indústrias, Distribuidores':'Nutrição, Hospitalar, Cozinhas'}</span></span>
                  </button>
                ))}
              </div>
            </div>
            {cl && <>
              <hr className="sb-div" />
              <div className="prog-area">
                <div className="prog-lbl"><span>Preenchimento</span><span>{pct}%</span></div>
                <div className="prog-bar"><div className="prog-fill" style={{ width: pct+'%' }} /></div>
              </div>
              <div className="sec-nav">
                {sections.map((s, i) => (
                  <div key={s.id} className={`nav-it${sec===i?' active':''}`} onClick={() => { setSec(i); setSidebarOpen(false) }}>
                    <span className="nav-num">{String(i+1).padStart(2,'0')}</span>
                    {s.title}
                    {isSectionDone(i) && <span className="nav-ck">✓</span>}
                  </div>
                ))}
              </div>
            </>}
          </aside>

          {/* main */}
          <main className="main">
            {!cl ? (
              <div className="intro">
                <div style={{ display:'flex',gap:7,marginBottom:18,alignItems:'center' }}>
                  {[['#040486',14],['#059E1E',14],['#040486',14],['#F4B800',10],['#F4B800',10]].map(([c,s],i) => (
                    <span key={i} style={{ width:s+'px',height:s+'px',borderRadius:'50%',background:String(c),display:'block',marginTop:i>=3?8:0 }} />
                  ))}
                </div>
                <h1 className="intro-ttl">Inteligência<br /><span>Comercial</span> Teknisa</h1>
                <p className="intro-dsc">Selecione o tipo de checklist, preencha o diagnóstico e gere um relatório executivo estratégico completo com análise de conta, oportunidades, riscos e roadmap.</p>
                <div className="intro-cards">
                  {[['🎯','Diagnóstico de Conta','Fit, maturidade, tier e leitura política'],['🔍','Research Automático','Busca dados públicos via CNPJ e redes'],['🗺️','Roadmap por Ondas','Expansão estratégica em fases personalizadas']].map(([icon,ttl,dsc]) => (
                    <div key={ttl} className="ic"><div className="ic-icon">{icon}</div><div className="ic-ttl">{ttl}</div><div className="ic-dsc">{dsc}</div></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="form-area">
                <div className="sec-hdr">
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div>
                      <div className="sec-num">SEÇÃO {String(sec+1).padStart(2,'00')} / {sections.length} — {def?.label}</div>
                      <h2 className="sec-ttl">{currentSec?.title}</h2>
                      <p className="sec-dsc">{currentSec?.desc}</p>
                    </div>
                    <button
                      onClick={resetChecklist}
                      title="Reiniciar checklist"
                      style={{
                        flexShrink: 0,
                        marginTop: 2,
                        background: 'transparent',
                        border: '1px solid rgba(232,77,77,.35)',
                        borderRadius: 6,
                        color: 'rgba(232,77,77,.7)',
                        fontFamily: "'Poppins',sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap',
                        transition: 'all .15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,77,77,.1)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#e84d4d'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#e84d4d'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,77,77,.35)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(232,77,77,.7)'
                      }}
                    >
                      🔄 Reiniciar
                    </button>
                  </div>
                </div>

                {/* RESEARCH BANNER */}
                {currentSec?.id === 'pesquisa' && (
                  <div className="res-banner">
                    <div className="rb-icon">🔍</div>
                    <div className="rb-txt">
                      <strong>Enriquecimento Automático:</strong> preencha CNPJ, site e redes e clique em <strong>Pesquisar Cliente</strong> para que a IA busque automaticamente dados públicos da empresa.<br />
                      <button className="res-btn" disabled={researchLoading} onClick={doResearch}>{researchLoading ? '⏳ Pesquisando...' : '🔍 Pesquisar Cliente'}</button>
                    </div>
                  </div>
                )}

                {/* SEFAZ BANNER */}
                {currentSec?.id === 'fiscal' && cl === 'retail' && (
                  <div className="res-banner sefaz-banner">
                    <div style={{ display:'flex',alignItems:'flex-start',gap:9,width:'100%' }}>
                      <div style={{ fontSize:16,marginTop:1 }}>🏛️</div>
                      <div className="rb-txt" style={{ flex:1 }}>
                        <strong>Consulta Receita Federal:</strong> informe o CNPJ e clique em <strong>Consultar</strong> para buscar dados fiscais com preenchimento automático dos campos abaixo.
                      </div>
                    </div>
                    <div style={{ display:'flex',gap:9,alignItems:'center',width:'100%',flexWrap:'wrap' }}>
                      <input type="text" value={sefazCnpj} maxLength={18} placeholder="00.000.000/0001-00"
                        onChange={e => setSefazCnpj(maskCnpj(e.target.value))}
                        style={{ flex:1,minWidth:190,maxWidth:260,background:'rgba(255,255,255,.08)',border:'1px solid rgba(244,184,0,.4)',borderRadius:8,color:'#fff',fontFamily:'Roboto,sans-serif',fontSize:12,padding:'7px 10px',outline:'none' }}
                      />
                      <button className="res-btn yellow" disabled={sefazLoading} onClick={doSefaz}>{sefazLoading ? '⏳ Consultando...' : '🏛️ Consultar CNPJ'}</button>
                      {sefazResult && <span style={{ fontSize:10,color:'var(--tk-green)',fontFamily:'Roboto,sans-serif' }}>✅ Dados encontrados</span>}
                    </div>
                    {sefazResult && (
                      <div style={{ width:'100%',padding:'12px 14px',background:'rgba(5,158,30,.07)',border:'1px solid rgba(5,158,30,.2)',borderRadius:8,fontFamily:'Roboto,sans-serif' }}>
                        <div style={{ fontFamily:'Poppins,sans-serif',fontSize:9,fontWeight:700,color:'var(--tk-green)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:9 }}>✅ Dados da Receita Federal</div>
                        {Object.entries(SEFAZ_LABELS).map(([k,label]) => (
                          <div key={k} className="sefaz-result-row">
                            <span className="sefaz-result-key">{label}</span>
                            <span className="sefaz-result-val" style={{ color: !sefazResult[k] || sefazResult[k]==='Não encontrado' ? 'rgba(255,255,255,.25)':'#fff' }}>{sefazResult[k] || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="fg">
                  {currentSec?.fields.map(f => renderField(f))}
                </div>

                <div className="form-nav">
                  <button className="btn btn-ghost" disabled={sec === 0} onClick={() => setSec(s => s - 1)}>← Anterior</button>
                  {sec === sections.length - 1
                    ? <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'flex-end' }}>
                        <button
                          className="btn"
                          style={{ background:'rgba(4,4,134,.6)', border:'1px solid rgba(4,4,134,.9)', color:'#fff', fontSize:13, fontWeight:700 }}
                          onClick={exportChecklistPDF}
                          disabled={checklistPdfLoading}
                        >
                          {checklistPdfLoading ? '⏳ Gerando PDF...' : '📋 Exportar Checklist PDF'}
                        </button>
                        <button className="btn btn-gen" onClick={generateReport}>✨ Gerar Relatório Estratégico</button>
                      </div>
                    : <button className="btn btn-pri" onClick={() => setSec(s => s + 1)}>Próximo →</button>
                  }
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* REPORT PAGE */}
      {page === 'report' && (
        <div className="report-layout">
          {loading ? (
            <div className="rpt-loader">
              <div className="loader-ring" />
              <div className="loader-msg">Analisando dados comerciais...<br />Construindo inteligência estratégica...<br />Gerando relatório executivo completo...</div>
            </div>
          ) : !reportHtml ? (
            <div className="rp-empty">
              <div className="big-ic">📋</div>
              <p>Preencha o checklist e clique em <strong>Gerar Relatório Estratégico</strong>.</p>
              <div className="hint">← Volte para o Checklist para começar</div>
            </div>
          ) : (
            <>
              <div className="rpt-bar">
                <div>
                  <div className="rpt-client-name">{clientName}</div>
                  <div className="rpt-meta">{def?.label} · {new Date().toLocaleDateString('pt-BR')} · Risco: {String(fd['risco'] || '—')}</div>
                </div>
                <div className="rpt-bar-right">
                  <button className="btn-rpt" onClick={() => setPage('checklist')}>← Checklist</button>
                  <button className="btn-rpt" onClick={copyReport}>⎘ Copiar</button>
                  <div style={{ position:'relative' }}>
                    <button className="btn-rpt btn-export" onClick={() => setExportOpen(o => !o)}>⬇ Exportar ▾</button>
                    {exportOpen && (
                      <div className="export-menu">
                        <div className="export-item" onClick={exportPDF}><span className="ei-icon">📄</span><div><div className="ei-label">PDF</div><div className="ei-sub">Janela de impressão</div></div></div>
                        <hr className="export-div" />
                        <div className="export-item" onClick={() => {
                          const client = String(fd['razao_social']||'Cliente')
                          const lines = reportMd.split('\n')
                          let rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}{\\colortbl;\\red3\\green2\\blue104;\\red176\\green125\\blue26;\\red42\\green100\\blue150;\\red80\\green80\\blue80;}\\margl1440\\margr1440\\margt1440\\margb1440\n`
                          const re = (s: string) => String(s).replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}').replace(/[^\x00-\x7F]/g,c=>{const code=c.charCodeAt(0);return code<256?`\\'${code.toString(16).padStart(2,'0')}`:`\\u${code}?`;})
                          rtf += `{\\pard\\qc\\f0\\b\\fs32\\cf1 Relatório Comercial Estratégico\\par}{\\pard\\qc\\f0\\fs20\\cf4 ${re(client)}\\par}{\\pard\\qc\\f0\\fs16\\cf4 ${new Date().toLocaleDateString('pt-BR')} — Teknisa\\par}{\\pard\\par}\n`
                          lines.forEach(l => {
                            if (!l.trim()) { rtf += `{\\pard\\par}\n`; return }
                            if (/^## /.test(l)) { rtf += `{\\pard\\sb220\\sa70\\f0\\b\\fs20\\cf2 ${re(l.replace(/^## /,'').replace(/\*\*/g,''))}\\par}\n`; return }
                            if (/^### /.test(l)) { rtf += `{\\pard\\sb140\\sa35\\f0\\b\\fs17\\cf3 ${re(l.replace(/^### /,''))}\\par}\n`; return }
                            if (/^---/.test(l)) { rtf += `{\\pard\\sa100\\par}\n`; return }
                            if (/^[-*\d.] /.test(l)) { rtf += `{\\pard\\li320\\fi-160\\f0\\fs18\\cf1 \\bullet  ${re(l.replace(/^[-*\d.] /,''))}\\par}\n`; return }
                            if (/^> /.test(l)) { rtf += `{\\pard\\li640\\ri640\\f0\\i\\fs18\\cf1 ${re(l.replace(/^> /,''))}\\par}\n`; return }
                            rtf += `{\\pard\\f0\\fs18\\cf1 ${re(l)}\\par}\n`
                          })
                          rtf += '}'
                          const blob = new Blob([rtf],{type:'application/rtf'})
                          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Relatorio_${client.replace(/\s+/g,'_')}_Teknisa.doc`; a.click(); URL.revokeObjectURL(a.href)
                          setExportOpen(false)
                        }}><span className="ei-icon">📝</span><div><div className="ei-label">Word (.doc)</div><div className="ei-sub">Arquivo editável</div></div></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="rpt-scroll" ref={reportRef}>
                <div className="rpt-inner">
                  {/* client banner */}
                  <div className="rc-banner">
                    <div>
                      <div className="rc-name">{clientName}</div>
                      <div className="rc-sub">{def?.label} · ERP: {String(fd['erp_atual']||'—')}</div>
                      <div className="rc-tier">{tier}</div>
                    </div>
                    <div className="rc-stats">
                      {[
                        [String(fd['qtd_unidades']||fd['contratos']||'—'),'Unidades'],
                        [String(fd['fat_rede']||fd['fat_total']||'—').replace(/R\$\s*/,'').split(' ')[0],'Faturamento'],
                        [String(fd['risco']||'—'),'Risco'],
                      ].map(([val,lbl]) => (
                        <div key={lbl} className="rc-stat">
                          <div className="rc-stat-val" style={{ fontSize:14, color: lbl==='Risco'?(val==='Alto'?'#e84d4d':val==='Médio'?'#F4B800':'#059E1E'):undefined }}>{val}</div>
                          <div className="rc-stat-lbl">{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
