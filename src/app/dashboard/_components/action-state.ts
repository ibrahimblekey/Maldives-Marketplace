/** Result every form-backed server action returns to its form. */
export type ActionState = { error: string | null; message?: string | null };

export const initialActionState: ActionState = { error: null, message: null };
