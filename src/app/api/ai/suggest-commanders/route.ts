import { generateObject } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { CommanderSuggestionsSchema } from '@/lib/ai/schemas'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { theme, description } = await request.json()

    if (!theme && !description) {
      return new Response(
        JSON.stringify({ error: 'theme or description is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `Suggest 3-5 Magic: The Gathering commanders that match the following theme and description.

Theme: ${theme ?? 'Not specified'}
Description: ${description ?? 'Not specified'}

For each commander, provide:
- The exact card name
- Color identity (array of color letters: W, U, B, R, G)
- Play style description
- Synergy notes explaining how the commander fits the theme
- Why this commander is a good choice for this theme/description`

    const { model } = await getAiModel('recommendations')

    const { object } = await generateObject({
      model,
      schema: CommanderSuggestionsSchema,
      prompt,
    })

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Suggest commanders error:', error)
    return new Response(
      JSON.stringify({ error: 'Suggest commanders failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
