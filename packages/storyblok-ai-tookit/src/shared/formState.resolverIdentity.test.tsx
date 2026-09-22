import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useController } from './useController'
import { useForm } from './useForm'

/** Written after the implementation, unlike the blind suite in `useForm.test.tsx`: a regression guard for the resolver being captured at mount. */

type Values = { name: string }

const allows = (values: Values) => ({ values, errors: {} })

const forbids = (values: Values) => ({
  values,
  errors: { name: { type: 'taken', message: 'Taken' } },
})

describe('a resolver replaced between renders (contract: the rules a form validates by can change while it is open)', () => {
  it('validates by the resolver it was given most recently', () => {
    const { result, rerender } = renderHook(
      ({ resolver }) => useForm<Values>({ defaultValues: { name: 'Legal' }, resolver }),
      { initialProps: { resolver: allows } },
    )

    expect(result.current.formState.isValid).toBe(true)

    rerender({ resolver: forbids })

    expect(result.current.formState.isValid).toBe(false)
  })

  it('validates a change by the newest resolver, not the one held at mount', () => {
    const { result, rerender } = renderHook(
      ({ resolver }) => {
        const form = useForm<Values>({ defaultValues: { name: '' }, resolver })

        return { form, field: useController({ name: 'name', control: form.control }) }
      },
      { initialProps: { resolver: allows } },
    )

    rerender({ resolver: forbids })
    act(() => result.current.field.field.onChange('Legal'))

    expect(result.current.form.formState.errors.name?.message).toBe('Taken')
  })

  it('judges a submit by the newest resolver, not the one held at mount', async () => {
    const onValid = vi.fn()
    const onInvalid = vi.fn()

    const { result, rerender } = renderHook(
      ({ resolver }) => useForm<Values>({ defaultValues: { name: 'Legal' }, resolver }),
      { initialProps: { resolver: allows } },
    )

    rerender({ resolver: forbids })
    await act(() => result.current.handleSubmit(onValid, onInvalid)())

    expect(onValid).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledWith({ name: { type: 'taken', message: 'Taken' } })
  })

  it('recomputes on reset by the newest resolver', () => {
    const { result, rerender } = renderHook(
      ({ resolver }) => useForm<Values>({ defaultValues: { name: 'Legal' }, resolver }),
      { initialProps: { resolver: allows } },
    )

    rerender({ resolver: forbids })
    act(() => result.current.reset())

    expect(result.current.formState.isValid).toBe(false)
  })
})
