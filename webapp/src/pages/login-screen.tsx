import { useForm } from '@tanstack/react-form'
import { loginRequestSchema, type LoginRequest } from '@dune/contracts'
import { useId, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { ApiRequestError } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'

type FieldErrors = Partial<Record<'email' | 'password', { message?: string }[]>>

// Single shared admin account — login only, no public registration (§10).
export function LoginScreen() {
  const auth = useAuth()
  const emailId = useId()
  const emailErrorId = useId()
  const passwordId = useId()
  const passwordErrorId = useId()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = loginRequestSchema.safeParse(value)
      if (!result.success) {
        const errors: FieldErrors = {}
        for (const issue of result.error.issues) {
          const field = issue.path[0]
          if (field === 'email' || field === 'password') {
            errors[field] = [...(errors[field] ?? []), { message: issue.message }]
          }
        }
        setFieldErrors(errors)
        return
      }
      setFieldErrors({})
      try {
        await auth.login(result.data as LoginRequest)
      } catch (caughtError) {
        setFormError(
          caughtError instanceof ApiRequestError ? caughtError.message : 'Не удалось войти',
        )
      }
    },
  })

  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-12">
      <div className="grid w-full max-w-sm gap-6">
        <div className="grid gap-2 text-center">
          <Typography variant="h4">DUNE — администрирование</Typography>
          <Typography tone="muted" variant="bodySm">
            Войдите, чтобы управлять объектами, заявками и контентом.
          </Typography>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Вход</CardTitle>
            <CardDescription>Логин и пароль администратора</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <FieldGroup className="gap-4">
                <form.Field
                  name="email"
                  children={(field) => (
                    <Field data-invalid={Boolean(fieldErrors.email?.length)}>
                      <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                      <Input
                        id={emailId}
                        name={field.name}
                        value={field.state.value}
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.email?.length)}
                        aria-describedby={fieldErrors.email?.length ? emailErrorId : undefined}
                        onChange={(event) => {
                          field.handleChange(event.target.value)
                          setFieldErrors((prev) => ({ ...prev, email: undefined }))
                          setFormError(null)
                        }}
                      />
                      <FieldError id={emailErrorId} errors={fieldErrors.email} />
                    </Field>
                  )}
                />
                <form.Field
                  name="password"
                  children={(field) => (
                    <Field data-invalid={Boolean(fieldErrors.password?.length)}>
                      <FieldLabel htmlFor={passwordId}>Пароль</FieldLabel>
                      <Input
                        id={passwordId}
                        name={field.name}
                        value={field.state.value}
                        type="password"
                        autoComplete="current-password"
                        aria-invalid={Boolean(fieldErrors.password?.length)}
                        aria-describedby={
                          fieldErrors.password?.length ? passwordErrorId : undefined
                        }
                        onChange={(event) => {
                          field.handleChange(event.target.value)
                          setFieldErrors((prev) => ({ ...prev, password: undefined }))
                          setFormError(null)
                        }}
                      />
                      <FieldError id={passwordErrorId} errors={fieldErrors.password} />
                    </Field>
                  )}
                />

                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Ошибка входа</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <form.Subscribe
                  selector={(state) => state.isSubmitting}
                  children={(isSubmitting) => (
                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Вход…' : 'Войти'}
                    </Button>
                  )}
                />
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
