import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FieldErrors, Resolver, UseFormProps } from "./formState.types";
import { useController } from "./useController";
import { useForm } from "./useForm";

/** Two string fields and one array-of-strings field. No domain meaning intended. */
type TestValues = {
  alpha: string;
  beta: string;
  items: string[];
};

/** Held apart so a copy of it can be a different object with equal contents. */
const DEFAULT_ITEMS: string[] = ["one", "two"];

const VALID_DEFAULTS: TestValues = {
  alpha: "a",
  beta: "b",
  items: DEFAULT_ITEMS,
};

const INVALID_DEFAULTS: TestValues = { alpha: "", beta: "", items: [] };

/** Toy rule: a value is wrong when it is empty. */
const resolver: Resolver<TestValues> = (values) => {
  const errors: FieldErrors<TestValues> = {};
  if (values.alpha === "") errors.alpha = { type: "empty", message: "alpha" };
  if (values.beta === "") errors.beta = { type: "empty", message: "beta" };
  if (!values.items || values.items.length === 0) {
    errors.items = { type: "empty", message: "items" };
  }
  return { values, errors };
};

/** Same rules, but it hands back a value it changed, to show which values travel on. */
const trimmingResolver: Resolver<TestValues> = (values) => ({
  values: { ...values, alpha: values.alpha.trim() },
  errors: {},
});

const renderForm = (props: UseFormProps<TestValues>) =>
  renderHook(() => {
    const form = useForm<TestValues>(props);
    return {
      form,
      alpha: useController<TestValues>({ name: "alpha", control: form.control }),
      beta: useController<TestValues>({ name: "beta", control: form.control }),
      items: useController<TestValues>({ name: "items", control: form.control }),
    };
  });

const deferred = () => {
  let resolve: () => void;
  let reject: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const swallow = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    () => undefined,
  );

describe("useForm and useController", () => {
  describe("an error on a field nobody has left yet (contract: formState.errors holds every error the resolver currently reports, whether or not the field has been touched, while a field's own error is present only once the field has been touched)", () => {
    it("reports an error in formState.errors for a field nobody has touched", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.formState.errors.alpha).toEqual({
        type: "empty",
        message: "alpha",
      });
    });

    it("reports an error in formState.errors as soon as a change makes a value invalid", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("");
      });

      expect(result.current.form.formState.errors.alpha).toEqual({
        type: "empty",
        message: "alpha",
      });
    });

    it("leaves the field's own error absent while the field has not been touched", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      expect(result.current.alpha.fieldState.error).toBeUndefined();
    });

    it("leaves the field's own error absent after a change alone, with no blur", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("");
      });

      expect(result.current.alpha.fieldState.error).toBeUndefined();
    });

    it("reads the field as valid while it has not been touched, even though the form is not", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      expect(result.current.alpha.fieldState.invalid).toBe(false);
    });

    it("shows the field's own error once the field has been left", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.alpha.fieldState.error).toEqual({
        type: "empty",
        message: "alpha",
      });
    });

    it("reads the field as invalid once the field has been left", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.alpha.fieldState.invalid).toBe(true);
    });

    it("does not show another field's error when one field is left", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.beta.fieldState.error).toBeUndefined();
    });

    it("gives a touched field no error of its own when the resolver reports none for it", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.alpha.fieldState.error).toBeUndefined();
    });

    it("marks a field it has been left as touched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.alpha.fieldState.isTouched).toBe(true);
    });
  });

  describe("isValid (contract: errors being empty and nothing else — it does not consider touched, so a form nobody has typed into is already invalid)", () => {
    it("is false on a form nobody has touched whose values are wrong", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.formState.isValid).toBe(false);
    });

    it("is true on a form nobody has touched whose values are right", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.formState.isValid).toBe(true);
    });

    it("turns true when the last wrong value is fixed, with no field ever left", () => {
      const { result } = renderForm({
        defaultValues: { alpha: "", beta: "b", items: DEFAULT_ITEMS },
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("a");
      });

      expect(result.current.form.formState.isValid).toBe(true);
    });

    it("turns false when a change makes a value wrong, with no field ever left", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.beta.field.onChange("");
      });

      expect(result.current.form.formState.isValid).toBe(false);
    });
  });

  describe("isDirty (contract: compares the current values against defaultValues by value — a field holding an array of strings is dirty only when its contents differ, never merely because the array is a different object)", () => {
    it("stays false when the array field is replaced by a different object with equal contents", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        // A spread always builds a new array, so this is a different object holding the same strings.
        result.current.items.field.onChange([...DEFAULT_ITEMS]);
      });

      expect(result.current.form.formState.isDirty).toBe(false);
    });

    it("turns true when the array field's contents really differ", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.items.field.onChange(["one", "three"]);
      });

      expect(result.current.form.formState.isDirty).toBe(true);
    });

    it("turns true when the array field gains an entry", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.items.field.onChange([...DEFAULT_ITEMS, "three"]);
      });

      expect(result.current.form.formState.isDirty).toBe(true);
    });

    it("turns true when a string field differs from its default", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.form.formState.isDirty).toBe(true);
    });

    it("returns to false when a changed string field is put back to its default", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });
      act(() => {
        result.current.alpha.field.onChange("a");
      });

      expect(result.current.form.formState.isDirty).toBe(false);
    });
  });

  describe("submitting values that are wrong (contract: marks every field touched so each error becomes visible at once, calls onInvalid if given, and does not call onValid)", () => {
    it("marks every field touched", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.touchedFields).toEqual({
        alpha: true,
        beta: true,
        items: true,
      });
    });

    it("makes every field's own error visible at once", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect([
        result.current.alpha.fieldState.error,
        result.current.beta.fieldState.error,
        result.current.items.fieldState.error,
      ]).toEqual([
        { type: "empty", message: "alpha" },
        { type: "empty", message: "beta" },
        { type: "empty", message: "items" },
      ]);
    });

    it("calls onInvalid with the errors the resolver reported", async () => {
      const { result } = renderForm({
        defaultValues: { alpha: "", beta: "b", items: DEFAULT_ITEMS },
        resolver,
      });
      const onInvalid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn(), onInvalid)();
      });

      expect(onInvalid).toHaveBeenCalledWith({
        alpha: { type: "empty", message: "alpha" },
      });
    });

    it("does not call onValid", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).not.toHaveBeenCalled();
    });

    it("settles when no onInvalid was given", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });
      let outcome = "did not settle";

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())().then(
          () => {
            outcome = "settled";
          },
          () => {
            outcome = "settled";
          },
        );
      });

      expect(outcome).toBe("settled");
    });
  });

  describe("submitting values that are right (contract: validates, then calls onValid with the resolver's values)", () => {
    it("calls onValid once", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledTimes(1);
    });

    it("calls onValid with the values the resolver returned, not the ones the form holds", async () => {
      const { result } = renderForm({
        defaultValues: { alpha: "  a  ", beta: "b", items: DEFAULT_ITEMS },
        resolver: trimmingResolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledWith({
        alpha: "a",
        beta: "b",
        items: DEFAULT_ITEMS,
      });
    });

    it("does not call onInvalid", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const onInvalid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn(), onInvalid)();
      });

      expect(onInvalid).not.toHaveBeenCalled();
    });
  });

  describe("the handler handed to a form's onSubmit (contract: the returned handler calls preventDefault when handed an event)", () => {
    it("calls preventDefault on the event it is handed", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const preventDefault = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())({ preventDefault });
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it("still calls onValid when it is called with no event at all", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledTimes(1);
    });

    it("still calls onValid when the event carries no preventDefault", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)({});
      });

      expect(onValid).toHaveBeenCalledTimes(1);
    });
  });

  describe("field.onChange (contract: takes either the new value itself or an event carrying it at target.value)", () => {
    it("takes a bare string as the new value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.form.getValues().alpha).toBe("z");
    });

    it("takes the value an event carries at target.value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange({ target: { value: "z" } });
      });

      expect(result.current.form.getValues().alpha).toBe("z");
    });

    it("takes a bare array as the new value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.items.field.onChange(["three"]);
      });

      expect(result.current.form.getValues().items).toEqual(["three"]);
    });

    it("shows the new value on field.value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.alpha.field.value).toBe("z");
    });
  });

  describe("watch and getValues (contract: both hand back the form's values, T)", () => {
    it("getValues hands back the defaults before anything has changed", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.getValues()).toEqual(VALID_DEFAULTS);
    });

    it("getValues hands back the current values after a change", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.beta.field.onChange("z");
      });

      expect(result.current.form.getValues().beta).toBe("z");
    });

    it("watch hands back the defaults before anything has changed", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.watch()).toEqual(VALID_DEFAULTS);
    });

    it("watch hands back the current values after a change", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.beta.field.onChange("z");
      });

      expect(result.current.form.watch().beta).toBe("z");
    });
  });

  describe("isSubmitting (contract: true from the moment a submit passes validation until the handler's promise settles, whether it resolves or rejects)", () => {
    it("is true while the handler's promise is still pending", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const gate = deferred();
      let settled: Promise<unknown>;

      await act(async () => {
        settled = swallow(
          result.current.form.handleSubmit(() => gate.promise)(),
        );
      });

      expect(result.current.form.formState.isSubmitting).toBe(true);

      await act(async () => {
        gate.resolve();
        await settled;
      });
    });

    it("is false again once the handler's promise resolves", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const gate = deferred();
      let settled: Promise<unknown>;

      await act(async () => {
        settled = swallow(
          result.current.form.handleSubmit(() => gate.promise)(),
        );
      });
      await act(async () => {
        gate.resolve();
        await settled;
      });

      expect(result.current.form.formState.isSubmitting).toBe(false);
    });

    it("is false again once the handler's promise rejects", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const gate = deferred();
      let settled: Promise<unknown>;

      await act(async () => {
        settled = swallow(
          result.current.form.handleSubmit(() => gate.promise)(),
        );
      });
      await act(async () => {
        gate.reject();
        await settled;
      });

      expect(result.current.form.formState.isSubmitting).toBe(false);
    });
  });

  describe("isSubmitted (contract: turns true on the first submit attempt and stays true — including an attempt that failed validation)", () => {
    it("turns true after an attempt that failed validation", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.isSubmitted).toBe(true);
    });

    it("turns true after an attempt that passed validation", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.isSubmitted).toBe(true);
    });

    it("stays true after a second attempt", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });
      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.isSubmitted).toBe(true);
    });
  });

  describe("submitting twice (contract: the returned handler validates, then either calls onValid or the invalid branch — each call anew)", () => {
    it("calls onValid again on the second submit", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });
      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledTimes(2);
    });

    it("judges the second submit on the values it finds then, not on the first attempt's verdict", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });
      const onValid = vi.fn();

      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });
      act(() => {
        result.current.alpha.field.onChange("a");
        result.current.beta.field.onChange("b");
        result.current.items.field.onChange(["one"]);
      });
      await act(async () => {
        await result.current.form.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledTimes(1);
    });
  });

  describe("reset with an argument (contract: replaces the values and the baseline isDirty measures against, and clears touched and isSubmitted)", () => {
    it("replaces the values with the ones it was given", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const next: TestValues = { alpha: "x", beta: "y", items: ["three"] };

      act(() => {
        result.current.form.reset(next);
      });

      expect(result.current.form.getValues()).toEqual(next);
    });

    it("makes the values it was given the baseline, so the form is not dirty", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });

      expect(result.current.form.formState.isDirty).toBe(false);
    });

    it("counts a return to the original defaults as dirty once the baseline has moved", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });
      act(() => {
        result.current.alpha.field.onChange(VALID_DEFAULTS.alpha);
      });

      expect(result.current.form.formState.isDirty).toBe(true);
    });

    it("clears touched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });
      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });

    it("hides again the error a touched field was showing", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });
      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect(result.current.alpha.fieldState.error).toBeUndefined();
    });

    it("leaves no errors behind when the values it was given are right", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset(VALID_DEFAULTS);
      });

      expect(result.current.form.formState.errors).toEqual({});
    });

    it("clears isSubmitted", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });
      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });

      expect(result.current.form.formState.isSubmitted).toBe(false);
    });
  });

  describe("reset without an argument (contract: returns to the defaultValues the form was created with)", () => {
    it("puts the values back to the defaults", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });
      act(() => {
        result.current.form.reset();
      });

      expect(result.current.form.getValues()).toEqual(VALID_DEFAULTS);
    });

    it("makes the defaults the baseline again, so the form is not dirty", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });
      act(() => {
        result.current.form.reset();
      });

      expect(result.current.form.formState.isDirty).toBe(false);
    });

    it("returns to the defaults the form was created with, not to a later reset's values", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });
      act(() => {
        result.current.form.reset();
      });

      expect(result.current.form.getValues()).toEqual(VALID_DEFAULTS);
    });

    it("clears touched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });
      act(() => {
        result.current.form.reset();
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });
  });

  describe("a form with nothing wrong (contract: a field with no entry has no error, and isValid is errors being empty)", () => {
    it("holds an errors object with no entry at all", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.formState.errors).toEqual({});
    });

    it("gives a field no error of its own even after every field has been left", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
        result.current.beta.field.onBlur();
        result.current.items.field.onBlur();
      });

      expect([
        result.current.alpha.fieldState.error,
        result.current.beta.fieldState.error,
        result.current.items.fieldState.error,
      ]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe("a field never entered (contract: touched is keyed by field name and one never entered is absent)", () => {
    it("has no entry in touchedFields on a form nobody has touched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });

    it("reads isTouched as false", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      expect(result.current.beta.fieldState.isTouched).toBe(false);
    });

    it("keeps its entry absent when another field is left", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.form.formState.touchedFields.beta).toBeUndefined();
    });
  });

  describe("reset to values that are wrong (contract: reset does not clear errors — it recomputes them from the new values; what a reset form hides is not the errors but their display, and clearing touched already does that)", () => {
    it("recomputes the errors from the values it was given", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect(result.current.form.formState.errors).toEqual({
        alpha: { type: "empty", message: "alpha" },
        beta: { type: "empty", message: "beta" },
        items: { type: "empty", message: "items" },
      });
    });

    it("reads as invalid, so the submit control stays disabled", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect(result.current.form.formState.isValid).toBe(false);
    });

    it("clears touched all the same", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });
      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });

    it("still holds every error in formState.errors after a submit had revealed them", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });
      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect(result.current.form.formState.errors).toEqual({
        alpha: { type: "empty", message: "alpha" },
        beta: { type: "empty", message: "beta" },
        items: { type: "empty", message: "items" },
      });
    });

    it("shows none of those errors on the fields themselves", async () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });
      act(() => {
        result.current.form.reset(INVALID_DEFAULTS);
      });

      expect([
        result.current.alpha.fieldState.error,
        result.current.beta.fieldState.error,
        result.current.items.fieldState.error,
      ]).toEqual([undefined, undefined, undefined]);
    });

    it("recomputes the errors from the defaults when it is called without an argument", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("a");
        result.current.beta.field.onChange("b");
        result.current.items.field.onChange(["one"]);
      });
      act(() => {
        result.current.form.reset();
      });

      expect(result.current.form.formState.errors).toEqual({
        alpha: { type: "empty", message: "alpha" },
        beta: { type: "empty", message: "beta" },
        items: { type: "empty", message: "items" },
      });
    });
  });

  describe("a submit that passes validation (contract: marks nothing touched — there is nothing to reveal)", () => {
    it("leaves touchedFields with no entry at all", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });

    it("adds no entry for the fields nobody left, keeping the one field that was left", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });
      await act(async () => {
        await result.current.form.handleSubmit(vi.fn())();
      });

      expect(result.current.form.formState.touchedFields).toEqual({
        alpha: true,
      });
    });
  });

  describe("the promise handleSubmit returns (contract: resolves whether the handler resolves or rejects — it is never rejected, so a caller need not guard the call)", () => {
    it("resolves when the handler's promise resolves", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      let outcome = "did not settle";

      await act(async () => {
        await result.current.form
          .handleSubmit(() => Promise.resolve("done"))()
          .then(
            () => {
              outcome = "resolved";
            },
            () => {
              outcome = "rejected";
            },
          );
      });

      expect(outcome).toBe("resolved");
    });

    it("resolves when the handler's promise rejects", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      let outcome = "did not settle";

      await act(async () => {
        await result.current.form
          .handleSubmit(() => Promise.reject(new Error("the handler failed")))()
          .then(
            () => {
              outcome = "resolved";
            },
            () => {
              outcome = "rejected";
            },
          );
      });

      expect(outcome).toBe("resolved");
    });
  });

  describe("fieldState.isValidating (contract: always false — the resolver is synchronous, so there is no moment to report)", () => {
    it("is false right after a change that makes the value wrong", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("");
      });

      expect(result.current.alpha.fieldState.isValidating).toBe(false);
    });

    it("is false while a submit's handler is still pending", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const gate = deferred();
      let settled: Promise<unknown>;

      await act(async () => {
        settled = swallow(
          result.current.form.handleSubmit(() => gate.promise)(),
        );
      });

      expect(result.current.alpha.fieldState.isValidating).toBe(false);

      await act(async () => {
        gate.resolve();
        await settled;
      });
    });
  });

  describe("fieldState.isDirty (contract: this field alone, compared against its default by value — not the whole form — and after reset(next) against the new baseline, as it is for the form)", () => {
    it("reads the changed field as dirty", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.alpha.fieldState.isDirty).toBe(true);
    });

    it("reads a field nobody changed as clean, though the form is dirty", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.beta.fieldState.isDirty).toBe(false);
    });

    it("reads the array field as clean when it is replaced by a different object with equal contents", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        // A spread always builds a new array, so this is a different object holding the same strings.
        result.current.items.field.onChange([...DEFAULT_ITEMS]);
      });

      expect(result.current.items.fieldState.isDirty).toBe(false);
    });

    it("reads the array field as dirty when its contents really differ", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.items.field.onChange(["one", "three"]);
      });

      expect(result.current.items.fieldState.isDirty).toBe(true);
    });

    it("reads a field as clean right after a reset to other values", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });
      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });

      expect(result.current.alpha.fieldState.isDirty).toBe(false);
    });

    it("reads a field put back to its original default as dirty once a reset has moved the baseline", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.form.reset({ alpha: "x", beta: "y", items: ["three"] });
      });
      act(() => {
        result.current.alpha.field.onChange(VALID_DEFAULTS.alpha);
      });

      expect(result.current.alpha.fieldState.isDirty).toBe(true);
    });
  });

  describe("what field.onChange counts as an event (contract: the first argument is an event only when it is an object with a target that itself has a value key, present or not; anything else is the value, and no argument at all sets undefined)", () => {
    it("takes an object without a target as the value itself", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const bare = { id: 1 };

      act(() => {
        result.current.alpha.field.onChange(bare);
      });

      expect(result.current.form.getValues().alpha as unknown).toEqual(bare);
    });

    it("takes an object whose target carries no value as the value itself", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      const bare = { target: { name: "alpha" } };

      act(() => {
        result.current.alpha.field.onChange(bare);
      });

      expect(result.current.form.getValues().alpha as unknown).toEqual(bare);
    });

    it("takes null as the value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange(null);
      });

      expect(result.current.form.getValues().alpha).toBeNull();
    });

    it("takes undefined as the value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange(undefined);
      });

      expect(result.current.form.getValues().alpha).toBeUndefined();
    });

    it("sets undefined when it is called with no argument at all", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange();
      });

      expect(result.current.form.getValues().alpha).toBeUndefined();
    });

    it("reads a target whose value key is present but undefined as an event, storing undefined rather than the event", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange({ target: { value: undefined } });
      });

      expect(result.current.form.getValues().alpha).toBeUndefined();
    });
  });

  describe("further arguments to field.onChange (contract: ignored, which is what lets a MUI handler of shape (event, value) be wired as (_, next) => field.onChange(next))", () => {
    it("ignores a second argument after a bare value", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z", "ignored");
      });

      expect(result.current.form.getValues().alpha).toBe("z");
    });

    it("ignores a second argument after an event", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange({ target: { value: "z" } }, "ignored");
      });

      expect(result.current.form.getValues().alpha).toBe("z");
    });
  });

  describe("touched comes from leaving, not from typing (contract: changing a value does not mark the field touched; only onBlur does, which keeps an error hidden while someone is still typing their first entry)", () => {
    it("leaves a changed field's entry out of touchedFields", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });

    it("reads a changed field as not touched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.onChange("z");
      });

      expect(result.current.alpha.fieldState.isTouched).toBe(false);
    });
  });

  describe("mode passed explicitly (contract: omitted, mode is 'onTouched' — the one value is also the default, so passing it must change nothing; every other group here omits it)", () => {
    it("keeps an untouched field's error hidden, as omitting it does", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
        mode: "onTouched",
      });

      expect(result.current.alpha.fieldState.error).toBeUndefined();
    });

    it("shows the error once the field has been left, as omitting it does", () => {
      const { result } = renderForm({
        defaultValues: INVALID_DEFAULTS,
        resolver,
        mode: "onTouched",
      });

      act(() => {
        result.current.alpha.field.onBlur();
      });

      expect(result.current.alpha.fieldState.error).toEqual({
        type: "empty",
        message: "alpha",
      });
    });
  });

  describe("field.ref (contract: a no-op, present only so the shape matches RHF's)", () => {
    it("leaves the values as they were", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.ref(null);
        result.current.alpha.field.ref({ tagName: "INPUT" });
      });

      expect(result.current.form.getValues()).toEqual(VALID_DEFAULTS);
    });

    it("leaves the field untouched", () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      act(() => {
        result.current.alpha.field.ref({ tagName: "INPUT" });
      });

      expect(result.current.form.formState.touchedFields).toEqual({});
    });
  });

  describe("a handler that throws synchronously (contract: treated exactly as one that returns a rejected promise)", () => {
    it("still resolves the promise handleSubmit returned", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      let outcome = "did not settle";

      await act(async () => {
        await result.current.form
          .handleSubmit(() => {
            throw new Error("the handler failed");
          })()
          .then(
            () => {
              outcome = "resolved";
            },
            () => {
              outcome = "rejected";
            },
          );
      });

      expect(outcome).toBe("resolved");
    });

    it("still clears isSubmitting", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await swallow(
          result.current.form.handleSubmit(() => {
            throw new Error("the handler failed");
          })(),
        );
      });

      expect(result.current.form.formState.isSubmitting).toBe(false);
    });

    it("still counts as a submit attempt", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await swallow(
          result.current.form.handleSubmit(() => {
            throw new Error("the handler failed");
          })(),
        );
      });

      expect(result.current.form.formState.isSubmitted).toBe(true);
    });
  });

  describe("a handler that returns something other than a promise (contract: awaited all the same, so isSubmitting may never be observably true for it — these check where it ends, not what it passes through)", () => {
    it("resolves the promise handleSubmit returned", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });
      let outcome = "did not settle";

      await act(async () => {
        await result.current.form
          .handleSubmit(() => "not a promise")()
          .then(
            () => {
              outcome = "resolved";
            },
            () => {
              outcome = "rejected";
            },
          );
      });

      expect(outcome).toBe("resolved");
    });

    it("leaves isSubmitting false once the submit has finished", async () => {
      const { result } = renderForm({
        defaultValues: VALID_DEFAULTS,
        resolver,
      });

      await act(async () => {
        await result.current.form.handleSubmit(() => "not a promise")();
      });

      expect(result.current.form.formState.isSubmitting).toBe(false);
    });
  });
});
