"use client";

import { useLocale } from "@/components/locale-provider";

export function ProblemSolution() {
  const { t } = useLocale();

  return (
    <section className="py-16 sm:py-20" aria-labelledby="problem-title">
      <div className="section grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2
            id="problem-title"
            className="text-3xl font-semibold text-forest-deep sm:text-4xl"
          >
            {t.problem.title}
          </h2>
          <ul className="mt-6 space-y-4">
            {t.problem.items.map((item) => (
              <li
                key={item}
                className="border-l-4 border-soil pl-4 text-lg text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-forest-deep sm:text-4xl">
            {t.problem.solutionTitle}
          </h2>
          <ul className="mt-6 space-y-4">
            {t.problem.solutions.map((item) => (
              <li
                key={item}
                className="border-l-4 border-forest pl-4 text-lg text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
