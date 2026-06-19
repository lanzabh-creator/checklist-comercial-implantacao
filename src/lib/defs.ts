export type FieldType =
  | 'text' | 'number' | 'textarea' | 'select' | 'radio'
  | 'chips' | 'radio_conditional' | 'regime_dynamic' | 'risk' | 'risk_tooltip' | 'pdf_upload'

export interface ConditionalField {
  id: string
  label: string
  type: 'text' | 'pdf_upload'
  ph?: string
}

export interface Field {
  id: string
  label: string
  type: FieldType
  ph?: string
  opts?: string[]
  conditionalOpt?: string
  conditionalField?: ConditionalField
}

export interface Section {
  id: string
  title: string
  desc: string
  fields: Field[]
}

export interface ChecklistDef {
  label: string
  sections: Section[]
}

export const DEFS: Record<string, ChecklistDef> = {
  retail: {
    label: 'Retail / Food Service',
    sections: [
      {
        id: 'pesquisa', title: 'Pesquisa & Identificação',
        desc: 'Dados de identificação e fontes públicas. Clique em "Pesquisar Cliente" para enriquecer automaticamente.',
        fields: [
          { id: 'razao_social', label: 'Razão Social / Nome Fantasia', type: 'text', ph: 'Ex: Grupo Madero Restaurantes S.A.' },
          { id: 'cnpj', label: 'CNPJ Principal', type: 'text', ph: '00.000.000/0001-00' },
          { id: 'site', label: 'Site Oficial', type: 'text', ph: 'https://www.empresa.com.br' },
          { id: 'linkedin', label: 'LinkedIn (empresa)', type: 'text', ph: 'https://linkedin.com/company/...' },
          { id: 'instagram', label: 'Instagram', type: 'text', ph: 'https://instagram.com/...' },
          { id: 'research_extra', label: 'Informações descobertas na pesquisa', type: 'textarea', ph: 'Clique em Pesquisar Cliente para preencher automaticamente...' },
        ],
      },
      {
        id: 'visao', title: 'Perfil do Negócio',
        desc: 'Estrutura, porte e características da operação',
        fields: [
          { id: 'segmento', label: 'Segmento principal', type: 'text', ph: 'Ex: Hamburgueria, Pizzaria, Padaria...' },
          { id: 'tempo_op', label: 'Tempo de Operação', type: 'text', ph: 'Ex: 15 anos' },
          { id: 'qtd_unidades', label: 'Total de Unidades', type: 'number', ph: '0' },
          { id: 'lojas_proprias', label: 'Lojas Próprias', type: 'number', ph: '0' },
          { id: 'franquias', label: 'Franquias', type: 'number', ph: '0' },
          { id: 'regiao', label: 'Região de Atuação', type: 'text', ph: 'Ex: Nacional, Sudeste...' },
          { id: 'expansao', label: 'Expansão prevista (12 meses)', type: 'text', ph: 'Qtd. unidades novas' },
          { id: 'fat_rede', label: 'Faturamento Total da Rede (R$/ano)', type: 'text', ph: 'Ex: R$ 50 milhões' },
          { id: 'fat_loja', label: 'Faturamento médio por loja (R$/mês)', type: 'text', ph: 'Ex: R$ 150 mil' },
          { id: 'ticket_medio', label: 'Ticket Médio (R$)', type: 'number', ph: '0' },
          { id: 'dia_produto_mais_vendido', label: 'Dia da semana e produto mais vendidos', type: 'text', ph: 'Ex: Sábado — X-Burguer' },
          { id: 'horario', label: 'Horário de Funcionamento', type: 'text', ph: 'Ex: 11h–23h / 24h' },
          { id: 'op_24h', label: 'Operação 24h?', type: 'radio', opts: ['Sim', 'Não', 'Algumas unidades'] },
          { id: 'atendimento', label: 'Modelos de Atendimento', type: 'chips', opts: ['Mesa','Balcão','Comanda','Delivery','Autoatendimento (TAA/TAP)','Totem','QR Code','SmartPOS','Garçom com tablet'] },
          { id: 'canais', label: 'Canais de Venda', type: 'chips', opts: ['Consumo local','Retirada','Delivery próprio','Marketplace'] },
          { id: 'objetivo', label: 'Principal objetivo do cliente com o sistema', type: 'textarea', ph: 'O que o cliente quer conquistar?' },
          { id: 'dores', label: 'Maiores dores atuais com sistema / processo atual', type: 'textarea', ph: 'Detalhe as principais dores...' },
          { id: 'nao_perder', label: 'O que o cliente NÃO tem e quer ter? O que tem e não quer perder?', type: 'textarea', ph: 'Descreva...' },
        ],
      },
      {
        id: 'fiscal', title: 'Estrutura Jurídica & Fiscal',
        desc: 'CNPJs, regimes tributários e obrigações fiscais',
        fields: [
          { id: 'qtd_cnpjs', label: 'Nº CNPJs / Empresas (filiais e inscrições estaduais)', type: 'number', ph: '0' },
          { id: 'regime', label: 'Regime Tributário de cada CNPJ', type: 'regime_dynamic' },
          { id: 'contabilidade', label: 'Contabilidade', type: 'radio', opts: ['Interna','Externa','Mista'] },
          { id: 'holding', label: 'Existe Holding?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'docs_fiscais', label: 'Documentos Fiscais Emitidos', type: 'chips', opts: ['NFC-e','NF-e modelo 55','MDF-e','CT-e'] },
          { id: 'ops_fiscais', label: 'Operações com NF modelo 55', type: 'chips', opts: ['Venda','Transferência','Industrialização','Produção própria','Marketplace'] },
          { id: 'sped_tecnisa', label: 'Irá emitir SPED pelo Teknisa ou enviará XMLs para contabilidade?', type: 'radio', opts: ['SPED pelo Teknisa','XMLs para contabilidade','A definir'] },
          { id: 'modulo_contabil', label: 'Foi contratado módulo Contábil? Fechamento de balanço?', type: 'radio', opts: ['Sim — interno','Sim — terceirizado','Não contratado'] },
          { id: 'cert_digital', label: 'Modelo do Certificado Digital', type: 'radio', opts: ['A1 (arquivo) — preferencial','A3 (cartão)','Não possui'] },
        ],
      },
      {
        id: 'infra', title: 'Infraestrutura & Tecnologia',
        desc: 'Hospedagem, hardware, redes e equipamentos por unidade',
        fields: [
          { id: 'hospedagem', label: 'Modelo de hospedagem contratado', type: 'radio', opts: ['SaaS','Hosting','Local (On-premise)'] },
          { id: 'estrutura_loja', label: 'Estrutura atual da loja', type: 'chips', opts: ['Caixa dedicado','Servidor local','Celular','SmartPOS','Tablet'] },
          { id: 'estrutura_proposta', label: 'Estrutura proposta da loja', type: 'chips', opts: ['Caixa dedicado','Servidor Local','Celular','SmartPOS','Tablet'] },
          { id: 'qtd_pdvs', label: 'Quantidade de PDVs por unidade', type: 'number', ph: '0' },
          { id: 'modelo_smartpos', label: 'Modelo de SmartPOS (se aplicável)', type: 'text', ph: 'Ex: Sunmi D3 Pro, PAX A920...' },
          { id: 'internet_redundancia', label: 'Possui redundância de internet?', type: 'radio', opts: ['Sim','Não','Em implantação'] },
          { id: 'rede_tipo', label: 'Rede interna', type: 'radio', opts: ['Cabeada','Wi-Fi','Mista'] },
          { id: 'wifi_exclusivo', label: 'Wi-Fi exclusivo para o sistema ou compartilhado com clientes?', type: 'radio', opts: ['Exclusivo para sistema','Compartilhado com clientes','Sem Wi-Fi'] },
          { id: 'ti_especializado', label: 'Cliente possui TI especializado?', type: 'radio', opts: ['Sim — interno','Sim — terceirizado','Não possui'] },
          { id: 'config_minimas', label: 'Foi apresentado o link de configurações mínimas?', type: 'radio', opts: ['Sim','Não','Pendente'] },
          { id: 'impressoras', label: 'Modelo de impressoras (cupom/cozinha)', type: 'chips', opts: ['Cupom fiscal — Ethernet','Cupom fiscal — USB','Cozinha/Bar — Ethernet','Cozinha/Bar — USB'] },
          { id: 'impressora_nao_homologada', label: 'Possui modelo de impressora não homologado?', type: 'radio_conditional', opts: ['Não','Sim'], conditionalOpt: 'Sim', conditionalField: { id: 'impressora_nao_homologada_modelo', label: 'Informe o modelo da impressora não homologada', type: 'text', ph: 'Ex: Epson TM-T20, Bematech MP-4200...' } },
          { id: 'kds_tipo', label: 'Possui KDS (Kitchen Display System)?', type: 'radio', opts: ['Sim','Não','Em avaliação'] },
          { id: 'kds_tipos', label: 'Tipos de KDS (se possui)', type: 'chips', opts: ['Produção','Montagem','Expedição'] },
          { id: 'balanca_pinpad', label: 'Possui balança e/ou pinpad? Quais marcas/modelos?', type: 'text', ph: 'Ex: Balança Toledo + PinPad Ingenico IPP350' },
          { id: 'catraca', label: 'Possui catraca? Qual modelo?', type: 'text', ph: 'Modelo ou Não possui' },
          { id: 'leitor_rfid', label: 'Existem leitores de código de barras e/ou RFID/Crachá?', type: 'radio', opts: ['Sim — código de barras','Sim — RFID/Crachá','Ambos','Não'] },
        ],
      },
      {
        id: 'pdv', title: 'Operação de Vendas (PDV)',
        desc: 'Configurações fiscais, pagamentos, TEF e regras de venda',
        fields: [
          { id: 'modelo_fiscal', label: 'Modelo de transmissão de cupom fiscal', type: 'radio', opts: ['NFC-e','NFE'] },
          { id: 'token_csc', label: 'Cliente já possui Token CSC (para NFC-e)?', type: 'radio', opts: ['Sim','Não','A providenciar'] },
          { id: 'tef', label: 'Utiliza TEF?', type: 'radio', opts: ['Sim','Não','Em avaliação'] },
          { id: 'tef_fiserv', label: 'Cliente ciente da necessidade de contratar Fiserv para TEF?', type: 'radio', opts: ['Sim, ciente','Não se aplica'] },
          { id: 'nocash', label: 'Tem NoCash?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'nocash_fiserv', label: 'NoCash: cliente ciente de contratar FISERV Carat?', type: 'radio', opts: ['Sim, ciente','Não se aplica'] },
          { id: 'nocash_stores', label: 'NoCash: cliente quer Android e iOS?', type: 'radio', opts: ['Sim, ciente das contas dev','Apenas Android','Apenas iOS','Não se aplica'] },
          { id: 'eattake', label: 'Possui EatTake? Cliente ciente das taxas Stone?', type: 'radio', opts: ['Sim, ciente','Não possui'] },
          { id: 'adquirencia', label: 'Adquirência utilizada', type: 'chips', opts: ['Rede','Cielo','Stone','GetNet','Safra','PagSeguro','Outro'] },
          { id: 'odhen_pos', label: 'Irão utilizar OdhenPOS? Qual adquirente?', type: 'text', ph: 'Ex: Sim — Stone / Não utiliza' },
          { id: 'formas_pagamento', label: 'Formas de Pagamento nos PDVs', type: 'chips', opts: ['Dinheiro','Crédito','Débito','PIX','Vale Refeição','Vale Alimentação','Crédito próprio','Cortesia'] },
          { id: 'conciliador_cartoes', label: 'Terá conciliador de cartões?', type: 'radio_conditional', opts: ['Sim, já contratado','Sim, ainda não contratado','Não terá'], conditionalOpt: 'Sim, já contratado|Sim, ainda não contratado', conditionalField: { id: 'conciliador_van', label: 'Qual a VAN (conciliadora contratada)?', type: 'text', ph: 'Ex: Braspag, Cielo Conciliador, Swap...' } },
          { id: 'venda_nao_fiscal', label: 'Cliente terá venda não fiscal? Qual modalidade?', type: 'text', ph: 'Ex: Cortesia, funcionários... ou Não' },
          { id: 'politica_desconto', label: 'Possui política de desconto? Qual mecânica?', type: 'textarea', ph: 'Descreva as regras de desconto...' },
          { id: 'precos_diferenciados', label: 'Trabalham com preços diferenciados?', type: 'text', ph: 'Ex: Diferente por canal, delivery vs salão...' },
          { id: 'etiqueta', label: 'Precisa de etiqueta (gôndola) para venda?', type: 'radio', opts: ['Sim','Não','Outro tipo de etiqueta'] },
          { id: 'venda_peso', label: 'Haverá venda por peso (self-service)?', type: 'radio', opts: ['Sim — com controle de estoque debatido','Sim — controle não debatido','Não'] },
          { id: 'encomendas', label: 'Cliente possui encomendas? Qual solução?', type: 'text', ph: 'Descreva ou Não possui' },
          { id: 'garcom_comissao', label: 'Existem garçons? Política de comissão?', type: 'text', ph: 'Ex: Sim, 10% automático / Não possui garçons' },
          { id: 'painel_senha', label: 'Terá painel de senha / Pager digital?', type: 'radio', opts: ['Painel','Pager','Ambos','Não se aplica'] },
          { id: 'taa_tap', label: 'Haverá TAA (autoatendimento) ou TAP (autopagamento)?', type: 'text', ph: 'Ex: Sim, TAA — Android 12 / Não' },
        ],
      },
      {
        id: 'delivery', title: 'Delivery & Integrações',
        desc: 'Plataformas, motoboy, integrações e APIs',
        fields: [
          { id: 'delivery_plat', label: 'Plataformas de Delivery contratadas', type: 'chips', opts: ['iFood','Rappi','Uber Eats','99food','Keeta','Delivery próprio'] },
          { id: 'hub', label: 'Usa Hub Integrador?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'pct_delivery', label: '% do faturamento em Delivery', type: 'text', ph: 'Ex: 35%' },
          { id: 'motoboy', label: 'Possui motoboy próprio e rastreio de rotas?', type: 'radio', opts: ['Sim — com rastreio','Sim — sem rastreio','Não, terceirizado','Não realiza delivery'] },
          { id: 'integracoes', label: 'Integrações contratadas ou necessárias', type: 'chips', opts: ['Delivery','Contabilidade','CRM','Fidelidade','E-commerce','APIs externas','Pedido online'] },
          { id: 'api_nao_delivery', label: 'Existe alguma API contratada que não seja de delivery?', type: 'textarea', ph: 'Descreva as APIs ou Não possui' },
          { id: 'api_vendas_teknisa', label: 'Cliente precisará da API de Vendas Teknisa? Ciente do custo adicional?', type: 'radio', opts: ['Sim, ciente do custo','Não precisará'] },
          { id: 'crm_atual', label: 'CRM / Programa de Fidelidade atual', type: 'text', ph: 'Nome do sistema ou Não possui' },
          { id: 'crm_status', label: 'Status do CRM/Fidelidade', type: 'radio', opts: ['Sim ativo','Sim subutilizado','Não possui'] },
        ],
      },
      {
        id: 'produtos', title: 'Produtos, Produção & Estoque',
        desc: 'Cardápio, fichas técnicas, compras e controles de estoque',
        fields: [
          { id: 'qtd_skus', label: 'Quantidade total de SKUs (produtos)', type: 'number', ph: '0' },
          { id: 'tipos_produto', label: 'Tipos de Produtos', type: 'chips', opts: ['Revenda','Produção própria','Semi-acabado','Molhos / Bases','Insumos'] },
          { id: 'producao', label: 'Tipo de Produção', type: 'radio', opts: ['Só revenda','Produção própria','Ambos'] },
          { id: 'producao_estocada', label: 'Produz algo estocado, ou tudo feito na hora?', type: 'radio', opts: ['Produz e estoca','Tudo feito na hora','Misto'] },
          { id: 'estoque_negativo', label: 'Cliente ciente que não trabalhamos com estoque negativo?', type: 'radio', opts: ['Sim, ciente'] },
          { id: 'estoque_centralizado', label: 'Possui estoque centralizado?', type: 'radio', opts: ['Sim','Não','Parcialmente'] },
          { id: 'ficha_tec', label: 'Ficha Técnica dos produtos', type: 'radio', opts: ['Sim — atualizada','Sim — desatualizada','Não possui'] },
          { id: 'cardapio_pdf', label: 'Cliente possui cardápio em PDF para disponibilizar?', type: 'radio_conditional', opts: ['Não','Sim'], conditionalOpt: 'Sim', conditionalField: { id: 'cardapio_pdf_upload', label: 'Upload do cardápio em PDF', type: 'pdf_upload', ph: 'Selecionar arquivo PDF...' } },
          { id: 'combos', label: 'Quais combos o cliente possui?', type: 'textarea', ph: 'Descreva os tipos de combo ou Não possui' },
          { id: 'inv_freq', label: 'Frequência de contagem física do estoque', type: 'select', opts: ['Selecione','Diário','Semanal','Quinzenal','Mensal','Eventual'] },
          { id: 'almoxarifado', label: 'Trabalham com almoxarifado? Quantos e quais?', type: 'text', ph: 'Ex: 2 almoxarifados — central e cozinha / Não' },
          { id: 'unidade_medida_diff', label: 'Produtos comprados em unidade diferente da consumida?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'estoque_cnpj_diff', label: 'Estoques físicos iguais com CNPJs fiscalmente separados?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'estoque_ctrl', label: 'Controles de Estoque utilizados', type: 'chips', opts: ['Curva ABC','Lote/validade','Transferência entre lojas','WMS','FEFO/FIFO'] },
          { id: 'divergencia', label: 'Divergência recorrente de estoque?', type: 'radio', opts: ['Sim','Não','Às vezes'] },
          { id: 'compra_central', label: 'Modelo de Compras', type: 'radio', opts: ['Centralizada','Por unidade','Mista'] },
          { id: 'alcada_compras', label: 'Existe limite de valor para compradores? Quem aprova o Pedido de Compra?', type: 'textarea', ph: 'Descreva as alçadas ou Não possui' },
          { id: 'sem_cotacao', label: 'Cliente ciente que o módulo Compras não tem cotação nativa?', type: 'radio', opts: ['Sim, ciente'] },
          { id: 'portal_compras', label: 'Foi apresentado o Portal de Compras?', type: 'radio', opts: ['Sim, apresentado','Não possui/não aplicável','Pendente apresentação'] },
        ],
      },
      {
        id: 'financeiro', title: 'Financeiro & ERP',
        desc: 'Fluxo financeiro, bancos, CNAB e apuração de resultados',
        fields: [
          { id: 'aprovacao_pagamentos', label: 'Pagamentos necessitam de aprovação? Como são definidas as alçadas?', type: 'textarea', ph: 'Descreva o fluxo ou Não possui' },
          { id: 'conciliacao_bancaria', label: 'Conciliação bancária', type: 'radio', opts: ['Manual','Via importação OFX','Automática via API','A definir'] },
          { id: 'cnab_liberacao', label: 'Cliente ciente que precisa liberar o CNAB com o banco?', type: 'radio', opts: ['Sim, ciente','Não informado','Não se aplica'] },
          { id: 'cnab_receber', label: 'Utilizam CNAB/DDA para boletos (Contas a Receber)?', type: 'radio', opts: ['Sim','Não','A definir'] },
          { id: 'cnab_pagar', label: 'Utilizam CNAB/DDA para boletos (Contas a Pagar)?', type: 'radio', opts: ['Sim','Não','A definir'] },
          { id: 'bancos', label: 'Bancos utilizados', type: 'text', ph: 'Ex: Itaú, Bradesco, Banco do Brasil...' },
          { id: 'apuracao_resultado', label: 'Como a empresa apura resultados?', type: 'chips', opts: ['Por filial','Por departamento','Por projeto','Por unidade de negócio','Consolidado'] },
          { id: 'plano_contas', label: 'Já existe Plano de Contas padrão a ser importado?', type: 'radio', opts: ['Sim, já disponível','Não, será criado','A definir'] },
          { id: 'dre_apresentado', label: 'Foi apresentado o DRE ao cliente?', type: 'radio', opts: ['Sim','Não','Pendente'] },
        ],
      },
      {
        id: 'producao_industrial', title: 'Produção Industrial (se aplicável)',
        desc: 'Para clientes com fábrica, cozinha central ou produção estruturada',
        fields: [
          { id: 'prod_modelo', label: 'Produção é por pedidos das unidades (SC) ou por planejamento (MRP)?', type: 'radio', opts: ['Por pedidos de unidades (SC)','Por planejamento (MRP)','Misto','Não se aplica'] },
          { id: 'prod_integracao_fabrica', label: 'Realiza integração entre lojas e fábricas? Como chegam as solicitações?', type: 'textarea', ph: 'Descreva o fluxo de abastecimento ou Não se aplica' },
          { id: 'prod_base_calculo', label: 'Base de cálculo do plano de produção', type: 'chips', opts: ['Histórico de vendas','Sazonalidade','Estoque mín/máx','Meta de venda','A definir'] },
          { id: 'prod_mao_obra', label: 'Existe apontamento de mão de obra no chão de fábrica?', type: 'radio', opts: ['Sim','Não','Não se aplica'] },
          { id: 'prod_importacao_ft', label: 'Cliente ciente que não tem importação de ficha técnica?', type: 'radio', opts: ['Sim, ciente','Não se aplica'] },
          { id: 'prod_maquinas', label: 'Existe controle de tempo de uso de máquinas/equipamentos?', type: 'radio', opts: ['Sim','Não','Não se aplica'] },
          { id: 'prod_desperdicio', label: 'Como é controlado o desperdício e variação de rendimento dos lotes?', type: 'textarea', ph: 'Descreva o processo ou Não controla' },
          { id: 'prod_lote_tipo', label: 'Controle de lote', type: 'radio', opts: ['Sequencial','Por data de fabricação','Lote do fornecedor','Não possui','Não se aplica'] },
          { id: 'prod_validade', label: 'Como é o controle de validade dos produtos?', type: 'textarea', ph: 'Descreva o processo' },
          { id: 'prod_logistica', label: 'Logística: frota própria ou terceirizada? Necessidade de roteirização e MDF-e?', type: 'text', ph: 'Ex: Frota própria, necessita roteirização e MDF-e / Terceirizada' },
        ],
      },
      {
        id: 'sistemas', title: 'Sistemas, Tecnologia & Gestão',
        desc: 'Stack atual, integrações, KPIs e maturidade de gestão',
        fields: [
          { id: 'erp_atual', label: 'ERP/Sistema Atual', type: 'text', ph: 'Ex: TOTVS, Linx, nenhum...' },
          { id: 'pdv_atual', label: 'Sistema de PDV', type: 'text', ph: 'Nome do sistema' },
          { id: 'bi_atual', label: 'BI / Relatórios', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'rh_atual', label: 'RH / Folha', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'funciona', label: 'O que funciona bem no sistema atual? (não pode perder)', type: 'textarea', ph: 'Descreva...' },
          { id: 'planilhas', label: 'Existem planilhas paralelas ao sistema?', type: 'radio', opts: ['Sim, muitas','Algumas','Não'] },
          { id: 'relatorios_atuais', label: '3 a 5 relatórios que o cliente usa hoje', type: 'textarea', ph: 'Ex: 1. Vendas por produto, 2. CMV mensal...' },
          { id: 'reuniao_gestao', label: 'Qual dia do mês o cliente reunirá para analisar relatórios?', type: 'text', ph: 'Ex: Todo dia 5 / Não tem rotina definida' },
          { id: 'kpis', label: 'KPIs Acompanhados', type: 'chips', opts: ['CMV','Margem','Ticket Médio','Venda/hora','Performance Delivery','Ruptura','Desperdício','EBITDA','NPS','Produtividade'] },
          { id: 'controle_cmv', label: 'Cliente controla CMV dos produtos? Qual cálculo realiza?', type: 'text', ph: 'Ex: Sim — custo médio ponderado / Não controla' },
          { id: 'maturidade', label: 'Nível de Maturidade de Gestão', type: 'radio', opts: ['Alta','Média','Baixa'] },
          { id: 'proc_doc', label: 'Processos documentados? Responsáveis por área?', type: 'radio', opts: ['Sim — processos e responsáveis definidos','Parcialmente','Não possui processos definidos'] },
          { id: 'cult_kpi', label: 'Cultura de indicadores?', type: 'radio', opts: ['Sim','Em desenvolvimento','Não'] },
          { id: 'nps', label: 'Pesquisa de satisfação / NPS?', type: 'radio', opts: ['Sim','Não','Em avaliação'] },
          { id: 'base_clientes', label: 'Base ativa de clientes', type: 'text', ph: 'Ex: 500 mil cadastros' },
        ],
      },
      {
        id: 'projeto', title: 'Escopo, Projeto & Pessoas-Chave',
        desc: 'Comprometimentos, cronograma, equipe e expectativas alinhadas',
        fields: [
          { id: 'resultado', label: 'Resultado esperado com o projeto', type: 'textarea', ph: 'KPIs ou melhorias esperadas...' },
          { id: 'compromissos_fora_contrato', label: 'Compromissos assumidos na venda FORA do produto padrão', type: 'textarea', ph: 'Liste o que foi prometido além do escopo padrão...' },
          { id: 'nao_incluso', label: 'O que NÃO está incluso no contrato?', type: 'textarea', ph: 'Liste exclusões e limitações explícitas...' },
          { id: 'personalizacoes', label: 'Necessidades de personalização de sistema', type: 'textarea', ph: 'Nº dos chamados ou descrição das solicitações...' },
          { id: 'go_live', label: 'Data acordada da virada da primeira loja', type: 'text', ph: 'Ex: 15/08/2025' },
          { id: 'data_critica', label: 'Data crítica ou prazo máximo', type: 'text', ph: 'Ex: Fechamento fiscal dezembro / Black Friday' },
          { id: 'expectativa_prazo', label: 'Expectativa de prazo para entrada em produção e conclusão do projeto', type: 'text', ph: 'Ex: Go-live em 3 meses, projeto completo em 6 meses' },
          { id: 'custos_visitas', label: 'Foi mencionado sobre custos de agendas/visitas presenciais?', type: 'radio', opts: ['Sim, cliente ciente','Não foi mencionado','Não se aplica'] },
          { id: 'sponsor', label: 'Sponsor Executivo', type: 'text', ph: 'Nome e cargo' },
          { id: 'pessoas_chave', label: 'Pessoas-chave do cliente para o projeto', type: 'textarea', ph: 'Ex: João Silva — Gerente de TI, Maria Costa — Nutricionista...' },
          { id: 'freq_status_report', label: 'Frequência de reunião de status report com o sponsor', type: 'radio', opts: ['Semanal','Quinzenal','Mensal','A definir'] },
          { id: 'modulos_prio', label: 'Módulos Contratados / Prioritários', type: 'chips', opts: ['PDV','Estoque','Financeiro','Fiscal','Delivery','BI','CRM/Fidelidade','RH','Produção','Compras','NoCash','EatTake','TAA/TAP','KDS','Portal de Compras','IA/Analytics'] },
        ],
      },
      {
        id: 'riscos', title: 'Alertas Comerciais & Riscos para Implantação',
        desc: '⚠ Seção obrigatória — sinalize todos os pontos críticos ao time de implantação',
        fields: [
          { id: 'alertas', label: 'Alertas Identificados', type: 'chips', opts: ['Operação complexa','Sem processos definidos','Infraestrutura ruim','Alta expectativa vs. realidade','Dependência de terceiros','Equipe resistente','Histórico ruim com sistemas','Falta responsável interno','Baixa maturidade gerencial','Custo de visitas presenciais não comunicado'] },
          { id: 'op_complexa_desc', label: 'Operação complexa? Descreva', type: 'textarea', ph: 'Descreva a complexidade ou Não se aplica' },
          { id: 'promessas_fora_escopo', label: 'Alta expectativa vs. realidade — o que foi prometido além do escopo?', type: 'textarea', ph: 'Descreva ou Não se aplica' },
          { id: 'dependencia_terceiros', label: 'Dependência de terceiros? Quais?', type: 'textarea', ph: 'Liste as dependências ou Não se aplica' },
          { id: 'rotina_nao_atendida', label: 'Existe alguma rotina que o sistema NÃO atende? Nº do chamado', type: 'textarea', ph: 'Ex: #12345 — Relatório X / Não identificado' },
          { id: 'gargalos', label: 'O que pode ser gargalo na operação ou na implantação?', type: 'textarea', ph: 'Antecipe os obstáculos previstos...' },
          { id: 'risco', label: 'Classificação de Risco Global', type: 'risk_tooltip' },
          { id: 'concorrencia', label: 'Concorrência em avaliação', type: 'chips', opts: ['TOTVS','Linx','Sankhya','Aloha','Outro'] },
          { id: 'obs', label: 'Observações gerais do comercial para a equipe de implantação', type: 'textarea', ph: 'Tudo que a implantação precisa saber...' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // ERP INDUSTRIAL — 8 seções completas
  // ══════════════════════════════════════════════════════════
  erp: {
    label: 'ERP Industrial',
    sections: [
      {
        id: 'pesquisa', title: 'Pesquisa & Identificação',
        desc: 'Dados de identificação e fontes públicas. Clique em "Pesquisar Cliente" para enriquecer automaticamente.',
        fields: [
          { id: 'razao_social', label: 'Razão Social / Nome Fantasia', type: 'text', ph: 'Nome da empresa' },
          { id: 'cnpj', label: 'CNPJ Principal', type: 'text', ph: '00.000.000/0001-00' },
          { id: 'site', label: 'Site Oficial', type: 'text', ph: 'https://www.empresa.com.br' },
          { id: 'linkedin', label: 'LinkedIn (empresa)', type: 'text', ph: 'https://linkedin.com/company/...' },
          { id: 'instagram', label: 'Instagram', type: 'text', ph: 'https://instagram.com/...' },
          { id: 'research_extra', label: 'Informações descobertas na pesquisa', type: 'textarea', ph: 'Preencha automaticamente ou adicione manualmente...' },
        ],
      },
      {
        id: 'visao', title: 'Visão Geral',
        desc: 'Dados gerais e estrutura da empresa',
        fields: [
          { id: 'segmento', label: 'Segmento Principal', type: 'chips', opts: ['Indústria','Distribuição','Atacado','Facilities','Serviços','Logística','Importação'] },
          { id: 'subsegmento', label: 'Subsegmento', type: 'chips', opts: ['Alimentício','Metalúrgico','Químico','Têxtil','Higiene/Limpeza','Construção','Hospitalar','Tecnologia','Outros'] },
          { id: 'tempo_op', label: 'Tempo de Atuação', type: 'text', ph: 'Ex: 20 anos' },
          { id: 'regiao', label: 'Região de Atuação', type: 'text', ph: 'Ex: Nacional' },
          { id: 'qtd_unidades', label: 'Total de Unidades', type: 'number', ph: '0' },
          { id: 'filiais', label: 'Filiais', type: 'number', ph: '0' },
          { id: 'fabricas', label: 'Fábricas', type: 'number', ph: '0' },
          { id: 'cds', label: 'Centros de Distribuição', type: 'number', ph: '0' },
          { id: 'fat_total', label: 'Faturamento Total (R$/ano)', type: 'text', ph: 'Ex: R$ 200 milhões' },
          { id: 'objetivo', label: 'Principal objetivo do cliente com o sistema', type: 'textarea', ph: 'O que o cliente quer conquistar?' },
          { id: 'dores', label: 'Maiores dores atuais com sistema / processo atual', type: 'textarea', ph: 'Detalhe as principais dores...' },
        ],
      },
      {
        id: 'fiscal', title: 'Estrutura Jurídica & Fiscal',
        desc: 'CNPJs, regimes tributários e obrigações fiscais',
        fields: [
          { id: 'qtd_cnpjs', label: 'Nº CNPJs / Empresas', type: 'number', ph: '0' },
          { id: 'regime', label: 'Regime Tributário', type: 'regime_dynamic' },
          { id: 'contabilidade', label: 'Contabilidade', type: 'radio', opts: ['Interna','Externa','Mista'] },
          { id: 'holding', label: 'Holding?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'importacao', label: 'Importação / Operação Internacional?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'docs_fiscais', label: 'Documentos Fiscais Emitidos', type: 'chips', opts: ['NF-e modelo 55','NFS-e','CT-e','MDF-e','NFC-e','Conhecimento de transporte'] },
          { id: 'subst_trib', label: 'Possui Substituição Tributária?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'multi_estados', label: 'Opera em múltiplos estados?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'cert_digital', label: 'Modelo do Certificado Digital', type: 'radio', opts: ['A1 (arquivo) — preferencial','A3 (cartão)','Não possui'] },
        ],
      },
      {
        id: 'operacao', title: 'Operação & Volumes',
        desc: 'Modelo operacional e volumes de transação',
        fields: [
          { id: 'modelo_op', label: 'Modelo Operacional', type: 'radio', opts: ['Produção própria','Distribuição','Serviços','Híbrido'] },
          { id: 'tipo_prod', label: 'Tipo de Produção', type: 'radio', opts: ['Contínua','Sob demanda','Discreta','Processo contínuo'] },
          { id: 'pedidos_mes', label: 'Pedidos/mês (média)', type: 'number', ph: '0' },
          { id: 'notas_mes', label: 'NFs emitidas/mês', type: 'number', ph: '0' },
          { id: 'fat_mensal', label: 'Faturamento Mensal (R$)', type: 'text', ph: 'Ex: R$ 10 milhões' },
          { id: 'usuarios', label: 'Usuários Previstos no sistema', type: 'number', ph: '0' },
          { id: 'op_24h', label: 'Operação 24h / Turnos?', type: 'radio', opts: ['Sim 24h','Turnos','Não'] },
          { id: 'gestao_tipo', label: 'Gestão', type: 'radio', opts: ['Centralizada','Descentralizada','Mista'] },
          { id: 'gestao_rec', label: 'Recursos de Gestão existentes', type: 'chips', opts: ['Planejamento operacional','PCP','MRP','Controle de capacidade','Gestão de contratos','Centro de custo'] },
        ],
      },
      {
        id: 'producao', title: 'Produção & Engenharia',
        desc: 'Estrutura produtiva, BOM e controles de qualidade',
        fields: [
          { id: 'qtd_skus', label: 'Nº SKUs (aprox.)', type: 'number', ph: '0' },
          { id: 'tipos_prod', label: 'Tipos de Produto', type: 'chips', opts: ['Matéria-prima','Produto acabado','Semiacabado','Revenda','Serviços'] },
          { id: 'rastreab', label: 'Existe rastreabilidade?', type: 'radio', opts: ['Sim','Não','Em implantação'] },
          { id: 'ctrl_lote', label: 'Controle de lote/validade?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'producao_interna', label: 'Produz internamente?', type: 'radio', opts: ['Sim','Parcialmente','Não'] },
          { id: 'ordem_prod', label: 'Utiliza Ordem de Produção?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'bom', label: 'Possui BOM (Estrutura de Produto)?', type: 'radio', opts: ['Sim','Parcialmente','Não'] },
          { id: 'ctrl_perdas', label: 'Controle de perdas/refugo?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'engenharia', label: 'Recursos de Engenharia', type: 'chips', opts: ['Controle de revisão','Controle de versões','Ficha técnica','CAD/PLM','Chão de fábrica'] },
        ],
      },
      {
        id: 'logistica', title: 'Estoque, Logística & Compras',
        desc: 'Armazéns, distribuição e gestão de suprimentos',
        fields: [
          { id: 'armazens', label: 'Nº Armazéns / Depósitos', type: 'number', ph: '0' },
          { id: 'ctrl_estoque', label: 'Tipo de Controle de Estoque', type: 'radio', opts: ['Por endereço','Simples','WMS próprio'] },
          { id: 'est_rec', label: 'Recursos de Estoque', type: 'chips', opts: ['FEFO/FIFO','Controle de validade','Controle de lote','WMS','Inventário rotativo'] },
          { id: 'frota', label: 'Frota', type: 'radio', opts: ['Própria','Terceirizada','Mista'] },
          { id: 'roteirizacao', label: 'Possui roteirização?', type: 'radio', opts: ['Sim','Não','Em avaliação'] },
          { id: 'compras_tipo', label: 'Compras', type: 'radio', opts: ['Centralizadas','Descentralizadas','Mistas'] },
          { id: 'compras_rec', label: 'Recursos de Compras', type: 'chips', opts: ['Workflow de aprovação','Cotação','Fornecedores homologados','Contratos de fornecimento'] },
        ],
      },
      {
        id: 'financeiro', title: 'Financeiro & Controladoria',
        desc: 'Controle financeiro, bancos e estrutura de custos',
        fields: [
          { id: 'fin_rec', label: 'Recursos Financeiros', type: 'chips', opts: ['Fluxo de caixa','Orçamento','Forecast','Centro de custo','Controle por projeto','DRE gerencial'] },
          { id: 'bancos', label: 'Bancos Utilizados', type: 'text', ph: 'Ex: Itaú, Bradesco...' },
          { id: 'banco_rec', label: 'Recursos Bancários', type: 'chips', opts: ['CNAB','Conciliação bancária','PIX integrado','Cobrança registrada','Antecipação de recebíveis'] },
          { id: 'custo_rec', label: 'Gestão de Custos', type: 'chips', opts: ['Custo padrão','Custo médio','Rateios','Controle de margem','Formação de preço'] },
          { id: 'aprovacao_pagamentos', label: 'Pagamentos necessitam de aprovação? Como são definidas as alçadas?', type: 'textarea', ph: 'Descreva o fluxo ou Não possui' },
          { id: 'plano_contas', label: 'Já existe Plano de Contas padrão a ser importado?', type: 'radio', opts: ['Sim, já disponível','Não, será criado','A definir'] },
          { id: 'dre_apresentado', label: 'Foi apresentado o DRE ao cliente?', type: 'radio', opts: ['Sim','Não','Pendente'] },
        ],
      },
      {
        id: 'sistemas', title: 'Sistemas & Integrações',
        desc: 'Stack tecnológico atual e cenário de integração',
        fields: [
          { id: 'erp_atual', label: 'ERP Atual', type: 'text', ph: 'Nome do sistema' },
          { id: 'wms_atual', label: 'WMS', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'crm_atual', label: 'CRM', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'bi_atual', label: 'BI', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'rh_atual', label: 'RH / Folha', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'integracoes', label: 'Integrações necessárias', type: 'chips', opts: ['Bancos','Marketplace','E-commerce','Transportadoras','Contabilidade','APIs externas','Equipamentos industriais','Coletores/WMS'] },
          { id: 'funciona', label: 'O que funciona bem hoje? (não pode perder)', type: 'textarea', ph: 'Descreva...' },
          { id: 'planilhas', label: 'Existem planilhas paralelas ao sistema?', type: 'radio', opts: ['Sim, muitas','Algumas','Não'] },
          { id: 'modulos_prio', label: 'Módulos Contratados / Prioritários', type: 'chips', opts: ['Produção','Planejamento industrial','Estoque','Rastreabilidade','Compras','Fiscal','BI','Financeiro','RH','WMS','CRM','IA'] },
          { id: 'sponsor', label: 'Sponsor Executivo', type: 'text', ph: 'Nome e cargo' },
          { id: 'go_live', label: 'Expectativa de Go-Live', type: 'text', ph: 'Ex: Q3 2025' },
          { id: 'risco', label: 'Classificação de Risco', type: 'risk_tooltip' },
          { id: 'concorrencia', label: 'Concorrência em avaliação', type: 'chips', opts: ['TOTVS','Sankhya','SAP','Outro'] },
          { id: 'obs', label: 'Observações Comerciais', type: 'textarea', ph: 'Notas internas...' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // TECFOOD — 8 seções completas
  // ══════════════════════════════════════════════════════════
  tecfood: {
    label: 'TecFood',
    sections: [
      {
        id: 'pesquisa', title: 'Pesquisa & Identificação',
        desc: 'Dados de identificação e fontes públicas. Clique em "Pesquisar Cliente" para enriquecer automaticamente.',
        fields: [
          { id: 'razao_social', label: 'Razão Social / Nome Fantasia', type: 'text', ph: 'Nome da empresa' },
          { id: 'cnpj', label: 'CNPJ Principal', type: 'text', ph: '00.000.000/0001-00' },
          { id: 'site', label: 'Site Oficial', type: 'text', ph: 'https://www.empresa.com.br' },
          { id: 'linkedin', label: 'LinkedIn (empresa)', type: 'text', ph: 'https://linkedin.com/company/...' },
          { id: 'instagram', label: 'Instagram', type: 'text', ph: 'https://instagram.com/...' },
          { id: 'research_extra', label: 'Informações descobertas na pesquisa', type: 'textarea', ph: 'Preencha automaticamente ou manualmente...' },
        ],
      },
      {
        id: 'visao', title: 'Visão Geral',
        desc: 'Estrutura e porte operacional',
        fields: [
          { id: 'segmento', label: 'Segmentos de Atuação', type: 'chips', opts: ['Unidade administrada','Refeições transportadas','Merenda escolar','Hospitalar','Corporativo','Industrial','Prisional','Eventos'] },
          { id: 'tempo_op', label: 'Tempo de Atuação', type: 'text', ph: 'Ex: 12 anos' },
          { id: 'regiao', label: 'Região de Atuação', type: 'text', ph: 'Ex: Nacional' },
          { id: 'contratos', label: 'Contratos Ativos', type: 'number', ph: '0' },
          { id: 'unidades_op', label: 'Unidades Operacionais', type: 'number', ph: '0' },
          { id: 'cozinhas', label: 'Cozinhas Centrais', type: 'number', ph: '0' },
          { id: 'ref_dia', label: 'Refeições/dia (total)', type: 'number', ph: '0' },
          { id: 'fat_total', label: 'Faturamento Total (R$/ano)', type: 'text', ph: 'Ex: R$ 50 milhões' },
          { id: 'objetivo', label: 'Principal objetivo do cliente com o sistema', type: 'textarea', ph: 'O que o cliente quer conquistar?' },
          { id: 'dores', label: 'Maiores dores atuais com sistema / processo atual', type: 'textarea', ph: 'Detalhe as principais dores...' },
        ],
      },
      {
        id: 'contratos_op', title: 'Contratos & Operação',
        desc: 'Modelo de gestão contratual e operacional',
        fields: [
          { id: 'tipo_contrato', label: 'Tipo de Contratos', type: 'radio', opts: ['Públicos','Privados','Misto'] },
          { id: 'gestao_tipo', label: 'Gestão', type: 'radio', opts: ['Centralizada','Descentralizada','Mista'] },
          { id: 'cardapio_central', label: 'Planejamento central de cardápio?', type: 'radio', opts: ['Sim','Por unidade','Misto'] },
          { id: 'compras_tipo', label: 'Compras', type: 'radio', opts: ['Centralizadas','Por unidade','Mistas'] },
          { id: 'prestacao_contas', label: 'Prestação de contas para clientes públicos?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'exigencias', label: 'Exigências nos Contratos', type: 'chips', opts: ['Restrições nutricionais','Controle de alergênicos','Exigências sanitárias','Marca/produto exigido','Regras fiscais específicas'] },
        ],
      },
      {
        id: 'receituario', title: 'Receituário & Produção',
        desc: 'Controle de receitas, produção e rastreabilidade',
        fields: [
          { id: 'qtd_skus', label: 'Nº SKUs (aprox.)', type: 'number', ph: '0' },
          { id: 'receituario', label: 'Possui Receituário Padrão?', type: 'radio', opts: ['Sim — atualizado','Sim — desatualizado','Não'] },
          { id: 'rec_especificas', label: 'Receitas específicas por contrato?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'ctrl_nutricional', label: 'Controle nutricional?', type: 'radio', opts: ['Sim','Não','Em desenvolvimento'] },
          { id: 'alerg', label: 'Controle de alergênicos?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'rastreab', label: 'Necessita rastreabilidade?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'ctrl_lote', label: 'Controle de lote/validade?', type: 'radio', opts: ['Sim','Não','Parcialmente'] },
          { id: 'rendimento', label: 'Controle de rendimento?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'abastecimento', label: 'Frequência de abastecimento por categoria', type: 'chips', opts: ['Perecíveis diário','Secos semanal','Congelados quinzenal','Hortifruti diário'] },
        ],
      },
      {
        id: 'financeiro', title: 'Financeiro & Faturamento',
        desc: 'Estrutura financeira e modelo de faturamento',
        fields: [
          { id: 'fat_contrato', label: 'Faturamento por contrato?', type: 'radio', opts: ['Sim','Não'] },
          { id: 'periodicidade', label: 'Periodicidade de Faturamento', type: 'radio', opts: ['Diário','Decendial','Quinzenal','Mensal'] },
          { id: 'ctrl_cc', label: 'Controle por centro de custo?', type: 'radio', opts: ['Sim','Não','Em implantação'] },
          { id: 'custo_ref', label: 'Acompanha custo por refeição?', type: 'radio', opts: ['Sim','Não','Manual'] },
          { id: 'bancos', label: 'Bancos utilizados', type: 'text', ph: 'Ex: Itaú, Bradesco...' },
          { id: 'cnab_receber', label: 'Utilizam CNAB/DDA para boletos (Contas a Receber)?', type: 'radio', opts: ['Sim','Não','A definir'] },
          { id: 'cnab_pagar', label: 'Utilizam CNAB/DDA para boletos (Contas a Pagar)?', type: 'radio', opts: ['Sim','Não','A definir'] },
          { id: 'plano_contas', label: 'Já existe Plano de Contas padrão a ser importado?', type: 'radio', opts: ['Sim, já disponível','Não, será criado','A definir'] },
        ],
      },
      {
        id: 'sistemas', title: 'Sistemas & Integrações',
        desc: 'Stack tecnológico atual e mapeamento de integrações',
        fields: [
          { id: 'erp_atual', label: 'ERP/Sistema Atual', type: 'text', ph: 'Nome do sistema' },
          { id: 'sys_nutricional', label: 'Sistema Nutricional', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'bi_atual', label: 'BI / Relatórios', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'rh_atual', label: 'RH / Folha', type: 'text', ph: 'Nome ou Nenhum' },
          { id: 'integracoes', label: 'Integrações necessárias', type: 'chips', opts: ['Contabilidade','Sistemas do contratante','Portal de compras','BI','RH','Operador logístico'] },
          { id: 'funciona', label: 'O que funciona bem hoje? (não pode perder)', type: 'textarea', ph: 'Descreva...' },
          { id: 'planilhas', label: 'Existem planilhas paralelas ao sistema?', type: 'radio', opts: ['Sim, muitas','Algumas','Não'] },
        ],
      },
      {
        id: 'gestao', title: 'Gestão & Indicadores',
        desc: 'Maturidade de gestão e KPIs acompanhados',
        fields: [
          { id: 'kpis', label: 'KPIs Acompanhados', type: 'chips', opts: ['CMV','Custo por refeição','Desperdício','Produtividade','Ruptura','SLA','Resultado por contrato','Consumo per capita'] },
          { id: 'maturidade', label: 'Maturidade de Gestão', type: 'radio', opts: ['Alta','Média','Baixa'] },
          { id: 'proc_doc', label: 'Processos documentados? Responsáveis por área?', type: 'radio', opts: ['Sim — processos e responsáveis definidos','Parcialmente','Não possui processos definidos'] },
          { id: 'cult_kpi', label: 'Cultura de indicadores?', type: 'radio', opts: ['Sim','Em desenvolvimento','Não'] },
          { id: 'relatorios_atuais', label: '3 a 5 relatórios que o cliente usa hoje', type: 'textarea', ph: 'Ex: 1. Custo por refeição, 2. CMV por contrato...' },
        ],
      },
      {
        id: 'projeto', title: 'Projeto & Alertas Comerciais',
        desc: 'Objetivos, cronograma, pessoas-chave e riscos',
        fields: [
          { id: 'resultado', label: 'Resultado esperado com o projeto', type: 'textarea', ph: 'KPIs ou melhorias esperadas...' },
          { id: 'modulos_prio', label: 'Módulos Contratados / Prioritários', type: 'chips', opts: ['Receituário','Produção','Estoque','Compras','Financeiro','Fiscal','PDV','BI','Nutrição','Contratos','IA'] },
          { id: 'sponsor', label: 'Sponsor Executivo', type: 'text', ph: 'Nome e cargo' },
          { id: 'pessoas_chave', label: 'Pessoas-chave do cliente para o projeto', type: 'textarea', ph: 'Ex: João Silva — Nutricionista responsável, Maria Costa — TI...' },
          { id: 'go_live', label: 'Expectativa de Go-Live', type: 'text', ph: 'Ex: Q4 2025' },
          { id: 'data_critica', label: 'Data crítica ou prazo máximo', type: 'text', ph: 'Ex: Início de contrato público em jan/26' },
          { id: 'custos_visitas', label: 'Foi mencionado sobre custos de agendas/visitas presenciais?', type: 'radio', opts: ['Sim, cliente ciente','Não foi mencionado','Não se aplica'] },
          { id: 'freq_status_report', label: 'Frequência de reunião de status report com o sponsor', type: 'radio', opts: ['Semanal','Quinzenal','Mensal','A definir'] },
          { id: 'risco', label: 'Classificação de Risco Global', type: 'risk_tooltip' },
          { id: 'alertas', label: 'Alertas Comerciais', type: 'chips', opts: ['Operação complexa','Sem processos definidos','Infraestrutura ruim','Alta expectativa vs. realidade','Dependência do contratante','Operação altamente personalizada','Equipe resistente','Baixa maturidade gerencial','Custo de visitas presenciais não comunicado'] },
          { id: 'rotina_nao_atendida', label: 'Existe alguma rotina que o sistema NÃO atende? Nº do chamado', type: 'textarea', ph: 'Ex: #12345 — Relatório X / Não identificado' },
          { id: 'obs', label: 'Observações gerais do comercial para a equipe de implantação', type: 'textarea', ph: 'Tudo que a implantação precisa saber...' },
          { id: 'concorrencia', label: 'Concorrência em avaliação', type: 'chips', opts: ['Nutriplus','Eprocorpo','Oracle Food','SAP','Outro'] },
        ],
      },
    ],
  },
}
