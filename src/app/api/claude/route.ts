import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prompt,
      useWebSearch = false,
      maxTokens = 2000,
    } = body

    const tools = useWebSearch
      ? [
          {
            type: 'web_search_20250305' as const,
            name: 'web_search' as const,
          },
        ]
      : []

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      ...(tools.length > 0 ? { tools } : {}),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n')

    return NextResponse.json({ text })
  } catch (err: unknown) {
    console.error('Claude API Error:', err)

    const message =
      err instanceof Error
        ? err.message
        : 'Erro desconhecido'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
