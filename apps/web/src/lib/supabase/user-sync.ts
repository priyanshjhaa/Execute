import { db } from '@execute/db'
import { users } from '@execute/db/schema'
import { eq } from 'drizzle-orm'

export async function syncUser(supabaseId: string, email: string, name?: string) {
  try {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseId)
    })

    if (existingUser) {
      // Update existing user
      await db.update(users)
        .set({
          email,
          name: name || existingUser.name,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id))

      return existingUser
    }

    // Create new user
    const [newUser] = await db.insert(users)
      .values({
        supabaseId,
        email,
        name,
      })
      .returning()

    return newUser
  } catch (error) {
    console.error('Error syncing user:', error)
    throw error
  }
}
