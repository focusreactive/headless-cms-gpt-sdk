/**
 * Which fields of which component may be translated, as resolved from the space's
 * component schema.
 *
 * Keyed by the component's `component` value, which is what identifies a component
 * wherever it appears — at the top of a story, nested in another component, or
 * embedded in a rich text document. The rule is the same in all three places, and
 * that is the point: nothing here may depend on a field's name or on where it sits.
 */
export type TranslatableField = {
  /** The field's key on the component object. */
  field: string;
  /** The schema type — `text`, `textarea` or `richtext`. */
  type: string;
};

export type TranslatableFields = Record<string, TranslatableField[]>;

/** The `__i18n__` marker is reserved by Storyblok; no schema field may be named with it. */
export const holdsATranslation = (key: string) => key.includes("__i18n__");

/**
 * The translatable fields of one component, or none when the component has no
 * translatable fields or is absent from the schema. An unknown component is not an
 * error: a space can hold components this build has never seen.
 */
export const fieldsOf = (
  translatable: TranslatableFields | undefined,
  component: unknown,
): TranslatableField[] =>
  typeof component === "string" ? (translatable?.[component] ?? []) : [];
