import { db } from '@/lib/db'
import { adminAiConfig } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { AddProviderForm } from './add-provider-form'
import { ProviderActions } from './provider-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function maskApiKey(encrypted: string): string {
  try {
    const decrypted = decrypt(encrypted)
    return decrypted.slice(0, 8) + '••••••••••••••••'
  } catch {
    return '••••••••'
  }
}

export default async function AdminPage() {
  const configs = await db.select().from(adminAiConfig).orderBy(adminAiConfig.createdAt)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Provider Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Manage AI providers and models used across DeckPilot.
        </p>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No AI providers configured yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Add a provider below to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base capitalize">{config.provider}</CardTitle>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <ProviderActions id={config.id} isActive={config.isActive} />
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">API Key</dt>
                    <dd className="font-mono mt-0.5">{maskApiKey(config.apiKeyEncrypted)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Analysis</dt>
                    <dd className="font-mono mt-0.5">{config.modelAnalysis}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Recommendations</dt>
                    <dd className="font-mono mt-0.5">{config.modelRecommendations}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Chat</dt>
                    <dd className="font-mono mt-0.5">{config.modelChat}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Generation</dt>
                    <dd className="font-mono mt-0.5">{config.modelGeneration}</dd>
                  </div>
                  {config.usageLimitDailyCents != null && (
                    <div>
                      <dt className="text-muted-foreground">Daily Limit</dt>
                      <dd className="mt-0.5">${(config.usageLimitDailyCents / 100).toFixed(2)}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddProviderForm />
    </div>
  )
}
