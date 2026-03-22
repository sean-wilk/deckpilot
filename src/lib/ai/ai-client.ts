import Anthropic from '@anthropic-ai/sdk'

export async function collectAiResponse(
  streamingClient: { provider: string; client: unknown; model: string },
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  abortSignal: AbortSignal
): Promise<string> {
  let text = ''
  if (streamingClient.provider === 'anthropic') {
    const client = streamingClient.client as Anthropic
    const stream = client.messages.stream({
      model: streamingClient.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    for await (const event of stream) {
      if (abortSignal.aborted) break
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
      }
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = streamingClient.client as any
    const completion = await client.chat.completions.create({
      model: streamingClient.model,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    for await (const chunk of completion) {
      if (abortSignal.aborted) break
      const content = chunk.choices[0]?.delta?.content
      if (content) text += content
    }
  }
  return text
}
