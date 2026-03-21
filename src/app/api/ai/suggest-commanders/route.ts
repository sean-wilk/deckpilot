import { chat } from '@tanstack/ai'
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

    const { theme, description, tweak, preset, previousSuggestions } = await request.json()

    if (!theme && !description) {
      return new Response(
        JSON.stringify({ error: 'theme or description is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const presetModifiers: Record<string, string> = {
      more_budget: 'Prioritize commanders with lower-cost staples and budget-friendly strategies',
      more_competitive: 'Prioritize commanders with proven competitive track records and powerful synergies',
      more_casual: 'Prioritize commanders that create fun, interactive gameplay over raw power',
    }

    let prompt = `Suggest 5-8 Magic: The Gathering commanders that match the following theme and description.

Theme: ${theme ?? 'Not specified'}
Description: ${description ?? 'Not specified'}

For each commander, provide:
- The exact card name
- Color identity (array of color letters: W, U, B, R, G)
- Rate each commander's fit for the theme from 1-10 in the match_score field
- Play style description
- Provide a detailed synergy_description explaining how the commander fits the theme
- Why this commander is a good choice for this theme/description`

    if (preset && presetModifiers[preset]) {
      prompt += `\n${presetModifiers[preset]}`
    }

    if (tweak) {
      prompt += `\nAdditional instruction: ${tweak}`
    }

    if (previousSuggestions && previousSuggestions.length > 0) {
      prompt += `\nDo NOT suggest these commanders again: ${previousSuggestions.join(', ')}`
    }

    const { model, maxTokens } = await getAiModel('recommendations')

    const object = await chat({
      adapter: model,
      messages: [{ role: 'user', content: prompt }],
      outputSchema: CommanderSuggestionsSchema,
      maxTokens,
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
