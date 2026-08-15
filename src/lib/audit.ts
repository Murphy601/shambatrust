export type AnswerValue = "yes" | "partly" | "no";

export type RiskLevel = "low" | "medium" | "high";

const SCORE: Record<AnswerValue, number> = {
  yes: 2,
  partly: 1,
  no: 0,
};

export function scoreAnswers(answers: AnswerValue[]): {
  total: number;
  max: number;
  percent: number;
  level: RiskLevel;
} {
  const total = answers.reduce((sum, answer) => sum + SCORE[answer], 0);
  const max = answers.length * 2;
  const percent = Math.round((total / max) * 100);

  let level: RiskLevel = "high";
  if (percent >= 80) level = "low";
  else if (percent >= 45) level = "medium";

  return { total, max, percent, level };
}
