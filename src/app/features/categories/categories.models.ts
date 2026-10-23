// Modelos que reflejan los DTO de categorías de la API (HU-65).

export type CategoryKind = 'Expense' | 'Income';

export const categoryKinds: readonly CategoryKind[] = ['Expense', 'Income'];

/** Colores admitidos (Category.Colors en la API); cada uno es un token `--category-<color>` del tema. */
export const categoryColors = [
  'slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink',
] as const;

export type CategoryColor = (typeof categoryColors)[number];

/** Íconos admitidos (Category.Icons en la API); cada uno es un SVG de `CategoryIcon`. */
export const categoryIcons = [
  'food', 'groceries', 'transport', 'home', 'utilities', 'health', 'education', 'entertainment', 'shopping',
  'travel', 'gifts', 'subscriptions', 'salary', 'freelance', 'investments', 'other',
] as const;

export type CategoryIconName = (typeof categoryIcons)[number];

export interface CreateCategoryRequest {
  name: string;
  kind: CategoryKind;
  color: CategoryColor;
  icon: CategoryIconName;
}

// Reemplazo completo de los campos editables (PUT).
export interface UpdateCategoryRequest extends CreateCategoryRequest {
  isArchived: boolean;
}

// Categoría del usuario. Con movimientos no se puede borrar ni cambiar de clase.
export interface CategoryResponse {
  id: string;
  name: string;
  kind: CategoryKind;
  color: CategoryColor;
  icon: CategoryIconName;
  isArchived: boolean;
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
}

// Códigos de los conflictos 409 de categorías.
export type CategoryConflictCode = 'category_in_use' | 'category_kind_locked';
