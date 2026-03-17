import { streamObject } from 'ai'
import { getAiModel } from '@/lib/ai/providers'
import { GeneratedDeckSchema } from '@/lib/ai/schemas'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cards } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { commanderId, description, targetBracket, budgetLimitCents } = await request.json()

    if (!commanderId) {
      return new Response(
        JSON.stringify({ error: 'commanderId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch commander name from DB
    const commander = await db
      .select({ name: cards.name })
      .from(cards)
      .where(eq(cards.id, commanderId))
      .limit(1)

    if (!commander[0]) {
      return new Response(
        JSON.stringify({ error: 'Commander not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const commanderName = commander[0].name

    const budgetNote = budgetLimitCents
      ? `Budget limit: $${(budgetLimitCents / 100).toFixed(2)} total for the deck.`
      : 'No specific budget constraint.'

    const prompt = `Generate a complete 99-card Commander deck (excluding the commander) for "${commanderName}".

Strategy description: ${description ?? 'Build the strongest synergistic deck for this commander.'}
Target power bracket: ${targetBracket ?? 2} (1=casual, 2=focused, 3=optimized, 4=competitive)
${budgetNote}

Select exactly 99 cards that complement "${commanderName}" as the commander. For each card provide:
- The exact card name
- Category (e.g., ramp, card_draw, removal, board_wipe, win_condition, protection, land, synergy, utility)
- Reasoning for inclusion in this specific deck

Also provide an overall strategy summary and your estimated power bracket for the completed deck.`

    const { model } = await getAiModel('generation')

    const result = streamObject({
      model,
      schema: GeneratedDeckSchema,
      prompt,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Generate deck error:', error)
    return new Response(
      JSON.stringify({ error: 'Generate deck failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
