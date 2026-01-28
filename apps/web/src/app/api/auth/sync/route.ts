import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@execute/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { supabaseId, email, name } = await request.json()

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseId)
    })

    if (existingUser) {
      return NextResponse.json({ user: existingUser })
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
