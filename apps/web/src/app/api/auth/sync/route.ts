import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@execute/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { supabaseId, email, name } = await request.json()

    // First try exact Supabase user match.
    const existingUser = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseId)
    })

    if (existingUser) {
      return NextResponse.json({ user: existingUser })
    }

    // If the email already exists, reconnect that row to the current Supabase user.
    const existingEmailUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    })

    if (existingEmailUser) {
      const [updatedUser] = await db.update(users)
        .set({
          supabaseId,
          name: name || existingEmailUser.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingEmailUser.id))
        .returning()

      return NextResponse.json({ user: updatedUser })
    }

    // Create new user
    const [newUser] = await db.insert(users)
      .values({
        supabaseId,
        email,
        name,
      })
      .returning()

    return NextResponse.json({ user: newUser })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 }
    )
  }
}
