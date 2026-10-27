// Modelos de metas de ahorro (EP-15 HU-77); reflejan /api/goals.

/** Meta con sus cifras calculadas en el servidor (ninguna se guarda). */
export interface GoalResponse {
  id: string;
  name: string;
  currency: string;
  target: number;
  targetDate: string | null; // yyyy-MM-dd
  saved: number;
  remaining: number;
  percent: number;
  completed: boolean;
  isOverdue: boolean;
  monthsLeft: number | null;
  requiredPerMonth: number | null;
  averagePerMonth: number;
  estimatedCompletion: string | null;
  contributionsCount: number;
}

export interface ContributionResponse {
  id: string;
  amount: number; // negativo = retiro
  date: string;
  note: string | null;
  createdAt: string;
}

export interface GoalDetailResponse {
  goal: GoalResponse;
  contributions: ContributionResponse[];
}

export interface GoalRequest {
  name: string;
  currency: string;
  target: number;
  targetDate: string | null;
}

export interface ContributionRequest {
  amount: number;
  date: string;
  note: string | null;
}
