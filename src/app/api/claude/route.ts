import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, maxTokens = 4000 } = body

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel.' },
        { status: 500 }
      )
    }

    // Chamada simples — apenas para geração de relatório (sem web_search)
    const response = await client.messages.create({
      model: 'claude-opus-4-5',   // modelo estável disponível no free tier da API
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    return NextResponse.json({ text })

  } catch (err: unknown) {
    console.error('[/api/claude]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
