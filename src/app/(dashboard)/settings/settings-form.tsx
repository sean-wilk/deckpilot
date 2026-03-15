'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from './actions'
import { BRACKETS } from '@/lib/constants/brackets'

interface SettingsFormProps {
  displayName: string
  defaultBracket: number
}

export function SettingsForm({ displayName, defaultBracket }: SettingsFormProps) {
  return (
    <form action={updateProfile} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={displayName}
              placeholder="Your name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultBracket">Default bracket</Label>
            <select
              id="defaultBracket"
              name="defaultBracket"
              defaultValue={defaultBracket}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {BRACKETS.slice(0, 4).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} — {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This will be pre-selected when you create new decks.
            </p>
          </div>

          <Button type="submit">Save changes</Button>
        </CardContent>
      </Card>
    </form>
  )
}
