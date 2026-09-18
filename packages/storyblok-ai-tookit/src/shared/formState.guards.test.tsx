import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useController } from './useController'
import { useForm } from './useForm'

/**
 * Written after the implementation, unlike the blind suite in `useForm.test.tsx`: guards
 * for contract promises an audit found unguarded, each one a mutation that would have kept
 * that suite green.
 */

type Values = { name: string }

const wants = (values: Values) => ({
  values,
  errors: values.name ? {} : { name: { type: 'required', message: 'Required' } },
})

const form = (name: string) =>
  renderHook(() => useForm<Values>({ defaultValues: { name }, resolver: wants }))

describe('preventDefault on a submit that fails validation (contract: the returned handler calls preventDefault when handed an event)', () => {
  it('prevents the default even when nothing is submitted', async () => {
    const preventDefault = vi.fn()
    const { result } = form('')

    await act(() => result.current.handleSubmit(vi.fn())({ preventDefault }))

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })
})

describe('isSubmitting around a submit that fails validation (contract: true from the moment a submit passes validation)', () => {
  it('is false on a form nobody has submitted', () => {
    expect(form('').result.current.formState.isSubmitting).toBe(false)
  })

  it('stays false when validation rejected the submit', async () => {
    const { result } = form('')

    await act(() => result.current.handleSubmit(vi.fn())())

    expect(result.current.formState.isSubmitting).toBe(false)
  })
})

describe('isSubmitted at rest and after a bare reset (contract: turns true on the first submit attempt, until reset)', () => {
  it('is false on a form nobody has submitted', () => {
    expect(form('Legal').result.current.formState.isSubmitted).toBe(false)
  })

  it('is cleared by reset called without an argument', async () => {
    const { result } = form('Legal')

    await act(() => result.current.handleSubmit(vi.fn())())
    expect(result.current.formState.isSubmitted).toBe(true)

    act(() => result.current.reset())

    expect(result.current.formState.isSubmitted).toBe(false)
  })
})

describe('onChange handed a null target (contract: anything that is not an object with a target having a value key is the value)', () => {
  it('stores the argument and does not throw', () => {
    const { result } = renderHook(() => {
      const f = useForm<Values>({ defaultValues: { name: 'Legal' }, resolver: wants })

      return { f, field: useController({ name: 'name', control: f.control }) }
    })
    const argument = { target: null }

    act(() => result.current.field.field.onChange(argument))

    expect(result.current.f.getValues().name).toBe(argument)
  })
})
