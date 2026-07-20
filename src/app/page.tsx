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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [gDriveToken, setGDriveToken] = useState<string | null>(null)

  // ── Google Drive OAuth + Upload ───────────────────────────
  const GDRIVE_FOLDER = '1WewDj9_-L31fGH59XHCAgKMFQ32d3qac'
  const GCLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  const signInGoogle = () => {
    const params = new URLSearchParams({
      client_id: GCLIENT_ID,
      redirect_uri: window.location.origin + '/gdrive-callback',
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/drive.file',
      prompt: 'select_account',
    })
    const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'gdrive_login', 'width=500,height=600')
    // Listen for token from popup
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'gdrive_token') {
        setGDriveToken(e.data.token)
        popup?.close()
        window.removeEventListener('message', handler)
      }
    }
    window.addEventListener('message', handler)
  }

  const getOrCreateDriveFolder = async (token: string, sectionName?: string): Promise<string> => {
    const consultor = String(fd['consultor_nome'] || 'Consultor não identificado')
      .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '').trim().slice(0, 50)
    const prospect = String(fd['razao_social'] || 'Prospect')
      .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '').trim().slice(0, 40)
    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const clienteFolderName = `${prospect} — ${today}`

    const findOrCreate = async (name: string, parentId: string): Promise<string> => {
      const safe = name.replace(/'/g, "\\'")
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Erro ao buscar pasta "${name}": ${res.status}`)
      const data = await res.json()
      if (data.files?.length > 0) return data.files[0].id
      const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      })
      if (!cr.ok) throw new Error(`Erro ao criar pasta "${name}": ${cr.status}`)
      const cd = await cr.json()
      return cd.id
    }

    // Nível 1: Nome do consultor
    const consultorFolderId = await findOrCreate(consultor, GDRIVE_FOLDER)
    // Nível 2: Nome do cliente + data
    const clienteFolderId = await findOrCreate(clienteFolderName, consultorFolderId)
    // Nível 3: Nome da seção (se fornecido)
    if (sectionName) return await findOrCreate(sectionName, clienteFolderId)
    return clienteFolderId
  }

  const handleDriveUpload = async (fieldId: string, files: FileList | null, sectionName?: string) => {
    if (!files || files.length === 0) return
    if (!gDriveToken) { signInGoogle(); return }
    setField(fieldId + '_uploading', 'true')
    const prev: string[] = Array.from((fd[fieldId + '_files'] as string[] | undefined) || [])
    const newUploaded: string[] = []
    try {
      const folderId = await getOrCreateDriveFolder(gDriveToken, sectionName)
      for (const file of Array.from(files)) {
        const meta = JSON.stringify({ name: file.name, parents: [folderId] })
        const form = new FormData()
        form.append('metadata', new Blob([meta], { type: 'application/json' }))
        form.append('file', file)
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${gDriveToken}` },
          body: form,
        })
        if (res.ok) {
          newUploaded.push(file.name)
        } else {
          const err = await res.json().catch(() => ({}))
          if (res.status === 401) {
            setGDriveToken(null)
            alert('Sessão do Google expirada. Faça login novamente.')
            setField(fieldId + '_uploading', 'false')
            return
          }
          alert(`Erro ao enviar "${file.name}": ${err?.error?.message || res.status}`)
        }
      }
      // Force new array reference so React detects the change
      setFd(prev2 => ({
        ...prev2,
        [fieldId + '_files']: [...prev, ...newUploaded],
        [fieldId + '_uploading']: 'false',
      }))
      if (newUploaded.length > 0) {
        alert(`✅ ${newUploaded.length} arquivo(s) enviado(s) com sucesso para o Google Drive!`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Erro no upload: ${msg}`)
      setField(fieldId + '_uploading', 'false')
    }
  }
  const reportRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Scroll to top when section changes
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [sec])

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
      if (cur.includes(val)) return { ...prev, [id]: cur.filter(x => x !== val) }
      // Enforce max 3 for modulos_prio
      if (id === 'modulos_prio' && cur.length >= 3) {
        alert('⚠️ Selecione no máximo 3 módulos prioritários.\n\nDesmarque um antes de selecionar outro.')
        return prev
      }
      return { ...prev, [id]: [...cur, val] }
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
  const [comparativeLoading, setComparativeLoading] = useState(false)

  const generateComparativeReport = async () => {
    if (!def) return
    setComparativeLoading(true)
    setPage('report')
    setLoading(true)
    setReportHtml('')
    setReportMd('')
    const client = String(fd['razao_social'] || 'Cliente')

    const antes = {
      faturamento: String(fd['ad_fat_antes'] || 'Não informado'),
      margem: String(fd['ad_margem_antes'] || 'Não informado'),
      cmv: String(fd['ad_cmv_antes'] || 'Não informado'),
      desperdicio: String(fd['ad_desperdicio_antes'] || 'Não informado'),
      ticket: String(fd['ad_ticket_antes'] || 'Não informado'),
      obs: String(fd['ad_obs_antes'] || ''),
    }
    const depois = {
      faturamento: String(fd['ad_fat_depois'] || 'Não informado'),
      margem: String(fd['ad_margem_depois'] || 'Não informado'),
      cmv: String(fd['ad_cmv_depois'] || 'Não informado'),
      desperdicio: String(fd['ad_desperdicio_depois'] || 'Não informado'),
      ticket: String(fd['ad_ticket_depois'] || 'Não informado'),
      obs: String(fd['ad_obs_depois'] || ''),
    }

    const prompt = `Você é um analista sênior de resultados da Teknisa — empresa líder em software de gestão para food service, indústrias de alimentos e serviços de nutrição.

Analise o impacto da implantação dos sistemas Teknisa no cliente "${client}" com base nos indicadores antes e depois informados abaixo. Gere um RELATÓRIO COMPARATIVO DE RESULTADOS completo, analítico e executivo.

CLIENTE: ${client}
SEGMENTO: ${def.label}

INDICADORES ANTES DA IMPLANTAÇÃO:
- Faturamento: ${antes.faturamento}
- Margem Operacional: ${antes.margem}
- CMV: ${antes.cmv}
- Nível de Desperdício: ${antes.desperdicio}
- Ticket Médio de Vendas: ${antes.ticket}
${antes.obs ? `- Contexto adicional: ${antes.obs}` : ''}

INDICADORES DEPOIS DA IMPLANTAÇÃO:
- Faturamento: ${depois.faturamento}
- Margem Operacional: ${depois.margem}
- CMV: ${depois.cmv}
- Nível de Desperdício: ${depois.desperdicio}
- Ticket Médio de Vendas: ${depois.ticket}
${depois.obs ? `- Contexto adicional: ${depois.obs}` : ''}

Estruture o relatório com exatamente estas seções (use ## para seções e ### para subseções):

## RELATÓRIO COMPARATIVO DE RESULTADOS — ${client}
[Subtítulo: "Impacto da Implantação Teknisa — ${def.label}"]
[Parágrafo introdutório de 3-4 linhas contextualizando o cliente e o projeto]

---
## 1. PANORAMA GERAL DOS RESULTADOS
[Resumo executivo de 4-6 linhas com a visão geral do impacto. Destaque os ganhos mais expressivos.]

---
## 2. ANÁLISE INDICADOR A INDICADOR
### Faturamento
[Análise da variação, causas prováveis e impacto no negócio]
### Margem Operacional
[Análise da variação, causas prováveis e impacto]
### CMV (Custo da Mercadoria Vendida)
[Análise da variação e relação com os demais indicadores]
### Nível de Desperdício
[Análise da variação e impacto financeiro estimado]
### Ticket Médio de Vendas
[Análise da variação e fatores que contribuíram]

---
## 3. CORRELAÇÕES E INSIGHTS
[Identifique relações entre os indicadores. Ex: queda do CMV contribuiu para alta da margem. Seja analítico e específico com os números apresentados.]

---
## 4. FATORES DE SUCESSO DA IMPLANTAÇÃO
[Liste de 4 a 6 fatores que provavelmente explicam os resultados alcançados, com base nos dados]

---
## 5. OPORTUNIDADES IDENTIFICADAS
[Com base nos resultados, quais são as próximas oportunidades de melhoria ou expansão do uso do sistema? Liste de 3 a 5 oportunidades concretas]

---
## 6. CONCLUSÃO EXECUTIVA
[Parágrafo final de 4-6 linhas com a síntese do impacto e o valor gerado pela Teknisa para este cliente. Tom de caso de sucesso.]

> [Frase de impacto resumindo o resultado em uma linha]

Seja específico com os números. Compare os valores antes e depois em cada análise. Tom executivo e orientado a resultados.`

    try {
      const text = await callClaude(prompt, false, 3000)
      setReportMd(text)
      setReportHtml(mdToHtml(text))
    } catch {
      setReportHtml('<p style="color:#e84d4d">Erro ao gerar relatório comparativo. Tente novamente.</p>')
    }
    setLoading(false)
    setComparativeLoading(false)
  }

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
    // chips_conditional: chips where one option reveals an extra text field
    if (f.type === 'chips_conditional') {
      const condOpt = f.conditionalOpt || ''
      const cf = f.conditionalField!
      const cfv = String(fd[cf.id] || '')
      const isCondActive = vArr.includes(condOpt)
      return (
        <div key={f.id} className="fgrp s2">
          <label className="lbl">{f.label}</label>
          <div className="chips-grp">
            {f.opts?.map(o => <span key={o} className={`chip${vArr.includes(o) ? ' on' : ''}`} onClick={() => toggleChip(f.id, o)}>{o}</span>)}
          </div>
          {isCondActive && (
            <div style={{ marginTop: 8 }}>
              <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>{cf.label}</label>
              <input type="text" value={cfv} placeholder={cf.ph} onChange={e => setField(cf.id, e.target.value)} />
            </div>
          )}
        </div>
      )
    }
    // drive_upload: multi-file upload button that sends to Google Drive
    if (f.type === 'drive_upload') {
      const uploadedFiles = (fd[f.id + '_files'] as string[] | undefined) || []
      const isUploading = fd[f.id + '_uploading'] === 'true'
      const secTitle = currentSec?.title
      return (
        <div key={f.id} className="fgrp s2">
          <label className="lbl">{f.label || 'Anexar arquivos'}</label>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginTop:4 }}>
            <label style={{ background:'var(--tk-primary)', border:'1px solid var(--tk-yellow)', borderRadius:6, padding:'8px 14px', cursor: isUploading ? 'not-allowed' : 'pointer', fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:'#fff', display:'inline-flex', alignItems:'center', gap:6, opacity: isUploading ? .6 : 1 }}>
              {isUploading ? '⏳ Enviando...' : '📎 Selecionar arquivos'}
              <input type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv" style={{ display:'none' }}
                onChange={e => {
                  if (!gDriveToken) {
                    alert('⚠️ Faça login com o Google antes de enviar arquivos.\n\nClique em "🔐 Login Google" abaixo.')
                    return
                  }
                  handleDriveUpload(f.id, e.target.files, secTitle)
                }}
                disabled={!!isUploading} />
            </label>
            {uploadedFiles.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {uploadedFiles.map((name, i) => (
                  <span key={i} style={{ background:'rgba(5,158,30,.12)', border:'1px solid rgba(5,158,30,.3)', borderRadius:14, padding:'3px 10px', fontSize:11, color:'var(--tk-green)' }}>✅ {name}</span>
                ))}
              </div>
            )}
          </div>
          {!gDriveToken && (
            <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,.4)', fontFamily:"'Roboto',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              ⚠ Faça login com o Google para enviar arquivos ao Drive
              <button onClick={signInGoogle} style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.2)', borderRadius:5, color:'#fff', fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:600, padding:'3px 10px', cursor:'pointer' }}>
                🔐 Login Google
              </button>
            </div>
          )}
        </div>
      )
    }
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
              ) : cf.type === 'drive_upload' ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <label style={{ background: fd[cf.id + '_uploading'] === 'true' ? 'rgba(4,4,134,.4)' : 'var(--tk-primary)', border:'1px solid var(--tk-yellow)', borderRadius:6, padding:'8px 14px', cursor: fd[cf.id + '_uploading'] === 'true' ? 'not-allowed' : 'pointer', fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:'#fff', display:'inline-flex', alignItems:'center', gap:6, opacity: fd[cf.id + '_uploading'] === 'true' ? .7 : 1 }}>
                      {fd[cf.id + '_uploading'] === 'true' ? '⏳ Enviando...' : '📎 Selecionar arquivos'}
                      <input type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv" style={{ display:'none' }}
                        onChange={e => {
                          if (!gDriveToken) {
                            alert('⚠️ Faça login com o Google antes de enviar arquivos.\n\nClique em "🔐 Login Google" abaixo.')
                            return
                          }
                          handleDriveUpload(cf.id, e.target.files, currentSec?.title)
                        }}
                        disabled={fd[cf.id + '_uploading'] === 'true'} />
                    </label>
                    {!gDriveToken && (
                      <button onClick={signInGoogle} style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.2)', borderRadius:5, color:'#fff', fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:600, padding:'5px 10px', cursor:'pointer' }}>
                        🔐 Login Google
                      </button>
                    )}
                  </div>
                  {((fd[cf.id + '_files'] as string[] | undefined) || []).length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {((fd[cf.id + '_files'] as string[] | undefined) || []).map((name: string, i: number) => (
                        <span key={i} style={{ background:'rgba(5,158,30,.12)', border:'1px solid rgba(5,158,30,.3)', borderRadius:14, padding:'3px 10px', fontSize:11, color:'var(--tk-green)' }}>✅ {name}</span>
                      ))}
                    </div>
                  )}
                  {!gDriveToken && (
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', fontFamily:"'Roboto',sans-serif" }}>
                      ⚠ Faça login com o Google para enviar arquivos ao Drive
                    </div>
                  )}
                </div>
              ) : cf.type === 'textarea' ? (
                <textarea value={cfv} placeholder={cf.ph} onChange={e => setField(cf.id, e.target.value)} style={{ minHeight: 80 }} />
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
  const css = `
:root{
  --tk-primary:#040486;--tk-deep:#03004F;--tk-blue:#0800B7;--tk-royal:#0051D0;
  --tk-green:#059E1E;--tk-yellow:#F4B800;--tk-danger:#e84d4d;
  --bg:#F2F4F8;--surface:#fff;--surface2:#EEF0F5;
  --border:#DDE1EA;--border-focus:#040486;
  --text:#1A1D2E;--text-soft:#4B5063;--text-muted:#8B90A0;
  --radius:8px;--radius-lg:12px;
  --sb-w:240px;--sb-w-col:56px;
}
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#__next{height:100%;}
body{font-family:'Roboto',sans-serif;font-size:14px;color:var(--text);background:var(--bg);overflow:hidden;}

/* ── TOPBAR (mantém escura) ── */
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

/* ── LAYOUT ── */
.layout{position:fixed;top:54px;left:0;right:0;bottom:0;display:flex;flex-direction:row;}

/* ── SIDEBAR (mantém escura, colapsável) ── */
.sidebar{width:var(--sb-w);flex-shrink:0;background:var(--tk-deep);border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;overflow:hidden;height:100%;transition:width .22s cubic-bezier(.4,0,.2,1);}
.sidebar.collapsed{width:var(--sb-w-col);}
.sb-toggle{display:flex;align-items:center;justify-content:flex-end;padding:10px 10px 0;flex-shrink:0;}
.sb-toggle-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.5);font-size:14px;width:30px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
.sb-toggle-btn:hover{background:rgba(255,255,255,.12);color:#fff;}
.sb-sec{padding:12px 12px 0;overflow:hidden;}
.sb-lbl{font-family:'Poppins',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.3);margin-bottom:8px;white-space:nowrap;overflow:hidden;}
.sidebar.collapsed .sb-lbl{opacity:0;}
.cl-sel{display:flex;flex-direction:column;gap:4px;}
.cl-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);padding:9px 11px;cursor:pointer;text-align:left;color:rgba(255,255,255,.6);transition:all .18s;display:flex;align-items:center;gap:8px;width:100%;min-width:0;}
.cl-btn:hover{border-color:rgba(255,255,255,.3);color:#fff;}
.cl-btn.active{border-color:var(--tk-yellow);background:rgba(244,184,0,.1);color:#fff;}
.cl-btn.active .cl-name{color:var(--tk-yellow);}
.sidebar.collapsed .cl-btn{padding:9px;justify-content:center;gap:0;}
.cl-icon{font-size:16px;flex-shrink:0;}
.cl-info{flex:1;min-width:0;overflow:hidden;}
.sidebar.collapsed .cl-info{display:none;}
.cl-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:11px;display:block;white-space:nowrap;}
.cl-desc{font-size:10px;opacity:.6;display:block;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-div{border:none;border-top:1px solid rgba(255,255,255,.08);margin:10px 0;flex-shrink:0;}
.prog-area{padding:0 12px 12px;overflow:hidden;}
.sidebar.collapsed .prog-area{display:none;}
.prog-lbl{font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:6px;display:flex;justify-content:space-between;}
.prog-bar{height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--tk-yellow),var(--tk-green));border-radius:2px;transition:width .35s;}
.sec-nav{display:flex;flex-direction:column;gap:1px;padding:0 6px 12px;overflow:hidden;flex:1;overflow-y:auto;}
.nav-it{padding:6px 8px;border-radius:var(--radius);cursor:pointer;color:rgba(255,255,255,.45);font-size:11px;transition:all .14s;display:flex;align-items:center;gap:6px;user-select:none;white-space:nowrap;min-width:0;}
.nav-it:hover{background:rgba(255,255,255,.07);color:#fff;}
.nav-it.active{background:rgba(4,4,134,.6);color:#fff;border-left:2px solid var(--tk-yellow);}
.sidebar.collapsed .nav-it{justify-content:center;padding:8px 0;}
.nav-num{font-size:9px;font-weight:500;color:rgba(255,255,255,.35);min-width:16px;flex-shrink:0;}
.sidebar.collapsed .nav-num{font-size:10px;color:rgba(255,255,255,.5);}
.nav-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sidebar.collapsed .nav-label{display:none;}
.nav-ck{margin-left:auto;font-size:9px;color:var(--tk-green);flex-shrink:0;}
.sidebar.collapsed .nav-ck{display:none;}
.sb-update-btn{margin:0 10px 14px;background:rgba(5,158,30,.12);border:1px solid rgba(5,158,30,.35);border-radius:8px;color:var(--tk-green);font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .18s;overflow:hidden;width:calc(100% - 20px);}
.sb-update-btn:hover{background:rgba(5,158,30,.22);}
.sidebar.collapsed .sb-update-btn{justify-content:center;padding:10px 0;width:calc(100% - 12px);margin:0 6px 14px;}
.sb-update-label{white-space:nowrap;overflow:hidden;}
.sidebar.collapsed .sb-update-label{display:none;}

/* ── MAIN (tema claro) ── */
.main{flex:1;overflow-y:auto;background:var(--bg);}
.form-area{padding:24px 32px;max-width:900px;width:100%;}

/* ── SECTION HEADER ── */
.sec-hdr{margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border);}
.sec-num{font-size:9px;font-weight:600;color:var(--text-muted);letter-spacing:2.5px;text-transform:uppercase;}
.sec-ttl{font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;color:var(--tk-primary);margin:4px 0 6px;line-height:1.25;}
.sec-dsc{color:var(--text-soft);font-size:12px;line-height:1.6;}

/* ── FORM GRID ── */
.fg{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.fgrp{display:flex;flex-direction:column;gap:5px;}
.fgrp.s2{grid-column:span 2;}
label.lbl{font-family:'Poppins',sans-serif;font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-transform:uppercase;}

/* ── INPUTS (tema claro) ── */
input[type=text],input[type=number],select,textarea{
  background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);
  color:var(--text);font-family:'Roboto',sans-serif;font-size:13px;padding:9px 12px;
  width:100%;transition:border-color .18s,box-shadow .18s;outline:none;
  -webkit-appearance:none;appearance:none;
}
input[type=text]:hover,input[type=number]:hover,select:hover,textarea:hover{border-color:#B0B8CC;}
input[type=text]:focus,input[type=number]:focus,select:focus,textarea:focus{
  border-color:var(--tk-primary);box-shadow:0 0 0 3px rgba(4,4,134,.1);
}
input::placeholder,textarea::placeholder{color:var(--text-muted);}
textarea{resize:vertical;min-height:72px;line-height:1.6;}
select option{background:#fff;color:var(--text);}

/* ── BANNERS ── */
.res-banner{background:#EEF2FF;border:1.5px solid #C7D2FE;border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:9px;}
.rb-icon{font-size:16px;margin-top:1px;flex-shrink:0;}
.rb-txt{font-size:12px;color:var(--text-soft);line-height:1.65;}
.rb-txt strong{color:var(--tk-primary);font-weight:700;}
.res-btn{margin-top:8px;background:var(--tk-primary);border:none;border-radius:6px;color:#fff;font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;padding:7px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;touch-action:manipulation;transition:background .15s;}
.res-btn:hover{background:var(--tk-blue);}
.res-btn:disabled{opacity:.5;cursor:not-allowed;}
.res-btn.yellow{background:var(--tk-yellow);color:#1A1D2E;}
.res-btn.yellow:hover{background:#e0a800;}

/* ── CHIPS ── */
.chips-grp{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}
.chip{display:inline-flex;align-items:center;background:var(--surface);border:1.5px solid var(--border);border-radius:16px;padding:5px 13px;cursor:pointer;font-size:12px;color:var(--text-soft);transition:all .14s;user-select:none;touch-action:manipulation;}
.chip:hover{border-color:#B0B8CC;color:var(--text);}
.chip.on{background:#EEF2FF;border-color:var(--tk-primary);color:var(--tk-primary);font-weight:600;}

/* ── RADIO ── */
.radio-grp{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}
.radio-opt{display:inline-flex;align-items:center;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:7px 14px;cursor:pointer;font-size:12px;color:var(--text-soft);transition:all .14s;user-select:none;touch-action:manipulation;}
.radio-opt:hover{border-color:#B0B8CC;color:var(--text);}
.radio-opt.on{background:#EEF2FF;border-color:var(--tk-primary);color:var(--tk-primary);font-weight:600;}

/* ── RISK ── */
.risk-row{display:flex;gap:7px;margin-top:4px;}
.risk-opt{flex:1;padding:10px 8px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface);text-align:center;cursor:pointer;font-family:'Poppins',sans-serif;font-size:12px;font-weight:600;transition:all .14s;user-select:none;touch-action:manipulation;color:var(--text-muted);}
.r-low.on{background:#F0FDF4;border-color:var(--tk-green);color:var(--tk-green);}
.r-med.on{background:#FFFBEB;border-color:#D97706;color:#D97706;}
.r-high.on{background:#FEF2F2;border-color:var(--tk-danger);color:var(--tk-danger);}

/* ── BUTTONS ── */
.form-nav{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:16px;border-top:1.5px solid var(--border);}
.btn{padding:10px 20px;border-radius:var(--radius);font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;border:none;display:inline-flex;align-items:center;gap:6px;touch-action:manipulation;}
.btn-ghost{background:transparent;border:1.5px solid var(--border);color:var(--text-soft);}
.btn-ghost:hover{border-color:#B0B8CC;color:var(--text);}
.btn-ghost:disabled{opacity:.3;cursor:not-allowed;}
.btn-pri{background:var(--tk-primary);color:#fff;}
.btn-pri:hover{background:var(--tk-blue);}
.btn-gen{background:var(--tk-primary);border:2px solid var(--tk-yellow);color:#fff;font-size:14px;font-weight:700;padding:12px 26px;border-radius:var(--radius-lg);box-shadow:0 4px 14px rgba(4,4,134,.25);}
.btn-gen:hover{background:var(--tk-blue);box-shadow:0 6px 20px rgba(4,4,134,.35);}

/* ── INTRO ── */
.intro{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;}
.intro-ttl{font-family:'Poppins',sans-serif;font-size:26px;font-weight:800;color:var(--tk-primary);margin-bottom:10px;line-height:1.2;}
.intro-ttl span{color:var(--tk-yellow);}
.intro-dsc{color:var(--text-soft);font-size:13px;line-height:1.7;max-width:460px;margin-bottom:22px;}
.intro-cards{display:flex;gap:9px;width:100%;max-width:520px;}
.ic{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:14px;flex:1;text-align:left;box-shadow:0 1px 4px rgba(0,0,0,.06);}
.ic-icon{font-size:20px;margin-bottom:6px;}
.ic-ttl{font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;color:var(--tk-primary);margin-bottom:3px;}
.ic-dsc{font-size:10px;color:var(--text-muted);line-height:1.5;}

/* ── MOBILE MENU BUTTON ── */
.mob-menu-btn{display:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:18px;padding:5px 9px;cursor:pointer;flex-shrink:0;touch-action:manipulation;line-height:1;}
.mob-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:150;top:54px;cursor:pointer;}

/* ── REPORT PAGE ── */
.report-layout{position:fixed;top:54px;left:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--bg);}
.rpt-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:14px;}
.loader-ring{width:32px;height:32px;border:2px solid var(--border);border-top-color:var(--tk-primary);border-radius:50%;animation:spin .75s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.loader-msg{font-size:11px;color:var(--text-muted);text-align:center;line-height:1.8;}
.rpt-bar{flex-shrink:0;background:var(--tk-deep);border-bottom:1px solid rgba(255,255,255,.08);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.rpt-client-name{font-family:'Poppins',sans-serif;font-size:14px;font-weight:700;color:#fff;}
.rpt-meta{font-size:9px;color:rgba(255,255,255,.35);}
.rpt-bar-right{display:flex;gap:7px;align-items:center;position:relative;flex-wrap:wrap;}
.btn-rpt{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:var(--radius);font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.7);touch-action:manipulation;transition:all .15s;}
.btn-rpt:hover{background:rgba(255,255,255,.15);color:#fff;}
.btn-export{background:rgba(244,184,0,.15);border:1px solid rgba(244,184,0,.5);color:var(--tk-yellow);}
.btn-export:hover{background:rgba(244,184,0,.25);}
.export-menu{position:absolute;top:calc(100% + 5px);right:0;background:var(--tk-deep);border:1px solid rgba(255,255,255,.15);border-radius:var(--radius-lg);padding:5px;min-width:190px;z-index:100;box-shadow:0 12px 40px rgba(0,0,0,.4);}
.export-item{display:flex;align-items:center;gap:9px;padding:10px;border-radius:var(--radius);cursor:pointer;touch-action:manipulation;}
.export-item:hover{background:rgba(255,255,255,.08);}
.export-item .ei-icon{font-size:15px;}
.export-item .ei-label{font-family:'Poppins',sans-serif;font-size:12px;font-weight:600;color:#fff;}
.export-item .ei-sub{font-size:9px;color:rgba(255,255,255,.35);}
.export-div{border:none;border-top:1px solid rgba(255,255,255,.08);margin:3px 0;}
.rpt-scroll{flex:1;overflow-y:auto;}
.rpt-inner{max-width:820px;margin:0 auto;padding:28px 24px 80px;}
.rc-banner{background:linear-gradient(135deg,var(--tk-primary),var(--tk-deep));border:1px solid rgba(244,184,0,.3);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;}
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
.rs-body{font-size:13px;color:rgba(255,255,255,.75);line-height:1.85;}
.rs-body strong{color:#fff;}
.rs-body h3{font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.9);text-transform:uppercase;letter-spacing:1.2px;margin:14px 0 6px;padding-left:9px;border-left:3px solid var(--tk-yellow);}
.rs-body ul{list-style:none;display:flex;flex-direction:column;gap:3px;padding-left:3px;margin:5px 0 9px;}
.rs-body li{display:flex;gap:9px;line-height:1.6;}
.rs-body li::before{content:'›';color:var(--tk-green);flex-shrink:0;margin-top:2px;font-weight:900;font-size:13px;}
.rs-body blockquote{border-left:3px solid var(--tk-yellow);padding:10px 14px;background:rgba(244,184,0,.06);border-radius:0 var(--radius) var(--radius) 0;margin:10px 0;color:#fff;font-size:13px;line-height:1.72;font-style:italic;font-weight:500;}
.rs-body p{margin-bottom:7px;}
.rs-body em{color:var(--tk-yellow);font-style:normal;font-weight:600;}
.rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;text-align:center;padding:24px;}
.rp-empty .big-ic{font-size:46px;opacity:.25;}
.rp-empty p{color:var(--text-soft);font-size:13px;max-width:280px;line-height:1.7;}
.rp-empty .hint{font-size:10px;color:var(--text-muted);background:var(--surface);border:1.5px solid var(--border);padding:7px 14px;border-radius:var(--radius);}
.sefaz-result-row{display:flex;gap:9px;padding:5px 0;border-bottom:1px solid var(--border);align-items:baseline;flex-wrap:wrap;}
.sefaz-result-key{min-width:130px;flex-shrink:0;font-size:9px;font-family:'Poppins',sans-serif;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;}
.sefaz-result-val{color:var(--text);font-size:11px;line-height:1.5;flex:1;}

/* ══ MOBILE ≤768px ══ */
@media(max-width:768px){
  body{overflow:auto;}
  .topbar{padding:0 10px;height:50px;}
  .tk-sub{display:none;}
  .hdr-client{display:none;}
  .status-pill{display:none;}
  .mob-menu-btn{display:flex;}
  .sb-toggle{display:none;}
  .layout{position:relative;top:0;flex-direction:column;min-height:calc(100vh - 50px);margin-top:50px;}
  .sidebar{position:fixed;top:50px;left:0;bottom:0;width:280px!important;z-index:160;transform:translateX(-100%);box-shadow:4px 0 24px rgba(0,0,0,.25);}
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
  .form-nav{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1.5px solid var(--border);padding:12px 16px;margin:0;z-index:140;box-shadow:0 -4px 16px rgba(0,0,0,.08);}
  .btn{padding:12px 20px;font-size:13px;}
  .btn-gen{padding:12px 20px;font-size:13px;}
  .tab-btn{padding:5px 8px;font-size:10px;}
}
@media(max-width:400px){
  .tk-wordmark{font-size:12px;letter-spacing:1px;}
  .tab-btn{padding:4px 7px;font-size:10px;}
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
          <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:9, fontWeight:700, color:'rgba(244,184,0,.7)', background:'rgba(244,184,0,.08)', border:'1px solid rgba(244,184,0,.2)', borderRadius:20, padding:'3px 9px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            v0.11.0-beta
          </div>
          <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">☰</button>
        </div>
      </header>

      {/* CHECKLIST PAGE */}
      {page === 'checklist' && (
        <div className="layout">
          {/* sidebar */}
          <div className={`mob-overlay${sidebarOpen?' open':''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen?' open':''}${sidebarCollapsed?' collapsed':''}`}>
        {/* Toggle button — desktop only */}
        <div className="sb-toggle">
          <button className="sb-toggle-btn" onClick={() => setSidebarCollapsed(c => !c)} title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
            <div className="sb-sec">
              <div className="sb-lbl">Tipo de Checklist</div>
              <div className="cl-sel">
                {Object.entries(DEFS).map(([key, d]) => (
                  <button key={key} className={`cl-btn${cl===key?' active':''}`} onClick={() => {
                    if (cl && cl !== key) {
                      try {
                        const fdSafe = Object.fromEntries(Object.entries(fd).filter(([k,v]) => !k.endsWith('_upload') && !(typeof v === 'string' && v.startsWith('data:'))))
                        localStorage.setItem(`tk_fd_${cl}`, JSON.stringify(fdSafe))
                      } catch {}
                    }
                    try {
                      const saved = localStorage.getItem(`tk_fd_${key}`)
                      setFd(saved ? JSON.parse(saved) : {})
                    } catch { setFd({}) }
                    const savedSec = parseInt(localStorage.getItem(`tk_sec_${key}`) || '0') || 0
                    setCl(key); setSec(savedSec); setSidebarOpen(false); setSefazResult(null); setSefazCnpj('')
                  }} title={d.label}>
                    <img src={key==='retail'?'data:image/png;base64,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':key==='erp'?'data:image/png;base64,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':'data:image/png;base64,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'} alt={key} style={{width:28,height:28,borderRadius:6,objectFit:'contain'}} />
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
                  <div key={s.id} className={`nav-it${sec===i?' active':''}`} onClick={() => { setSec(i); setSidebarOpen(false) }} title={s.title}>
                    <span className="nav-num">{String(i+1).padStart(2,'0')}</span>
                    <span className="nav-label">{s.title}</span>
                    {isSectionDone(i) && <span className="nav-ck">✓</span>}
                  </div>
                ))}
              </div>
              <hr className="sb-div" />
              <div style={{ padding:'0 10px 16px' }}>
                <button
                  onClick={() => { setSec(sections.findIndex(s => s.id === 'antes_depois')); setSidebarOpen(false) }}
                  className="sb-update-btn"
                  title="Atualizar Dados Pós-Implantação"
                >
                  <span style={{ fontSize:16, flexShrink:0 }}>📊</span>
                  <span className="sb-update-label">Atualizar Dados<br />Pós-Implantação</span>
                </button>
              </div>
            </>}
          </aside>

          {/* main */}
          <main className="main" ref={mainRef} style={{ transition:'none' }}>
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

                {/* ANTES & DEPOIS — layout especial em 2 colunas */}
                {currentSec?.id === 'antes_depois' ? (
                  <div>
                    {/* Info banner */}
                    <div className="res-banner" style={{ borderColor:'rgba(244,184,0,.3)', background:'rgba(244,184,0,.06)', marginBottom:20 }}>
                      <div className="rb-icon">📊</div>
                      <div className="rb-txt">
                        <strong>Como usar:</strong> preencha a coluna <strong>Antes</strong> agora, no início do projeto. A coluna <strong>Depois</strong> deve ser preenchida meses após a implantação. Use o botão <strong>"Atualizar Dados Pós-Implantação"</strong> na tela principal para acessar esta seção depois.
                      </div>
                    </div>
                    {/* 2-column table */}
                    <div style={{ overflowX:'auto', background:'#fff', borderRadius:12, border:'1.5px solid #DDE1EA', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
                        <thead>
                          <tr>
                            <th style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#8B90A0', textTransform:'uppercase', letterSpacing:'1.5px', padding:'10px 12px', textAlign:'left', width:'22%', borderBottom:'2px solid #DDE1EA', background:'#F2F4F8' }}>Indicador</th>
                            <th style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#4B5063', textTransform:'uppercase', letterSpacing:'1.5px', padding:'10px 12px', textAlign:'left', width:'39%', borderBottom:'2px solid #DDE1EA', background:'#FAFBFC' }}>🕐 Antes</th>
                            <th style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'#059E1E', textTransform:'uppercase', letterSpacing:'1.5px', padding:'10px 12px', textAlign:'left', width:'39%', borderBottom:'2px solid #86EFAC', background:'#F0FAF2' }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                                <span>✅ Depois</span>
                                <button
                                  onClick={generateComparativeReport}
                                  disabled={comparativeLoading}
                                  style={{ background:'#059E1E', border:'none', borderRadius:6, color:'#fff', fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, padding:'5px 10px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap', opacity: comparativeLoading ? .6 : 1 }}
                                >
                                  {comparativeLoading ? '⏳ Gerando...' : '📄 Relatório Antes & Depois'}
                                </button>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label:'Faturamento', antes:'ad_fat_antes', depois:'ad_fat_depois', phA:'Ex: R$ 2,5 milhões/mês', phD:'Ex: R$ 3,1 milhões/mês' },
                            { label:'Margem Operacional', antes:'ad_margem_antes', depois:'ad_margem_depois', phA:'Ex: 18%', phD:'Ex: 23%' },
                            { label:'CMV', antes:'ad_cmv_antes', depois:'ad_cmv_depois', phA:'Ex: 35%', phD:'Ex: 28%' },
                            { label:'Nível de Desperdício', antes:'ad_desperdicio_antes', depois:'ad_desperdicio_depois', phA:'Ex: 12% da produção', phD:'Ex: 5% da produção' },
                            { label:'Ticket Médio de Vendas', antes:'ad_ticket_antes', depois:'ad_ticket_depois', phA:'Ex: R$ 42,00', phD:'Ex: R$ 58,00' },
                          ].map(row => (
                            <tr key={row.antes} style={{ borderBottom:'1px solid #E5E9F0' }}>
                              <td style={{ padding:'10px 12px', fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:'#4B5063', width:'22%' }}>{row.label}</td>
                              <td style={{ padding:'6px 12px', background:'#FAFBFC', width:'39%' }}>
                                <input type="text" value={String(fd[row.antes] || '')} placeholder={row.phA}
                                  onChange={e => setField(row.antes, e.target.value)}
                                  style={{ background:'#fff', border:'1.5px solid #DDE1EA', borderRadius:6, color:'#1A1D2E', fontFamily:'Roboto,sans-serif', fontSize:13, padding:'8px 11px', width:'100%', outline:'none' }} />
                              </td>
                              <td style={{ padding:'6px 12px', background:'#F0FAF2', width:'39%' }}>
                                <input type="text" value={String(fd[row.depois] || '')} placeholder={row.phD}
                                  onChange={e => setField(row.depois, e.target.value)}
                                  style={{ background:'#fff', border:'1.5px solid #86EFAC', borderRadius:6, color:'#1A1D2E', fontFamily:'Roboto,sans-serif', fontSize:13, padding:'8px 11px', width:'100%', outline:'none' }} />
                              </td>
                            </tr>
                          ))}
                          {/* Observations row */}
                          <tr style={{ borderBottom:'1px solid #E5E9F0' }}>
                            <td style={{ padding:'10px 12px', fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:'#4B5063', verticalAlign:'top' }}>Observações</td>
                            <td style={{ padding:'6px 12px', background:'#FAFBFC', verticalAlign:'top' }}>
                              <textarea value={String(fd['ad_obs_antes'] || '')} placeholder="Outros indicadores ou contexto relevante do momento pré-implantação..."
                                onChange={e => setField('ad_obs_antes', e.target.value)}
                                style={{ background:'#fff', border:'1.5px solid #DDE1EA', borderRadius:6, color:'#1A1D2E', fontFamily:'Roboto,sans-serif', fontSize:13, padding:'8px 11px', width:'100%', outline:'none', minHeight:80, resize:'vertical' }} />
                            </td>
                            <td style={{ padding:'6px 12px', background:'#F0FAF2', verticalAlign:'top' }}>
                              <textarea value={String(fd['ad_obs_depois'] || '')} placeholder="Outros resultados ou contexto relevante após a implantação..."
                                onChange={e => setField('ad_obs_depois', e.target.value)}
                                style={{ background:'#fff', border:'1.5px solid #86EFAC', borderRadius:6, color:'#1A1D2E', fontFamily:'Roboto,sans-serif', fontSize:13, padding:'8px 11px', width:'100%', outline:'none', minHeight:80, resize:'vertical' }} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                <div className="fg">
                  {currentSec?.fields.map(f => {
                    // Hide coord_projeto detail fields unless coord_projeto = Sim
                    if (['coord_projeto_email','coord_projeto_tel'].includes(f.id) && fd['coord_projeto'] !== 'Sim') return null
                    // Hide coord_projeto_nome when it's a standalone field (ERP §17) unless Sim
                    if (f.id === 'coord_projeto_nome' && currentSec?.id === 'parecer' && fd['coord_projeto'] !== 'Sim') return null
                    // Hide custos_visitas detail fields unless Sim, cliente ciente
                    if (['custos_resp_nome','custos_resp_email','custos_resp_tel'].includes(f.id) && fd['custos_visitas'] !== 'Sim, cliente ciente') return null
                    return renderField(f)
                  })}
                </div>
                )}

                <div className="form-nav">
                  <button className="btn btn-ghost" disabled={sec === 0} onClick={() => setSec(s => s - 1)}>← Anterior</button>
                  {sec === sections.length - 1
                    ? <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'flex-end' }}>
                        <button
                          className="btn btn-gen"
                          onClick={exportChecklistPDF}
                          disabled={checklistPdfLoading}
                        >
                          {checklistPdfLoading ? '⏳ Gerando...' : '📋 Gerar Relatório'}
                        </button>
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
              <p>Preencha o checklist e clique em <strong>Gerar Relatório</strong> na última etapa.</p>
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
