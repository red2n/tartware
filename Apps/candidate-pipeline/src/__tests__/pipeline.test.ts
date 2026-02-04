import type { Logger } from "pino";
import { describe, expect, it } from "vitest";

import { CandidatePipeline } from "../pipeline.js";
import type { HasRequestId, HasScore, PipelineConfig, PipelineContext } from "../types.js";

interface TestQuery extends HasRequestId {
  requestId: string;
  limit?: number;
  hydrated?: boolean;
}

interface TestCandidate extends HasScore {
  id: string;
  hydrated?: boolean;
  postHydrated?: boolean;
}

const createLogger = (): Logger => {
  const logger = {
    child: () => logger,
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  } as unknown as Logger;
  return logger;
};

const baseConfig: PipelineConfig = {
  resultSize: 10,
  failOpen: true,
  enableParallelExecution: true,
};

describe("CandidatePipeline.execute", () => {
  it("executes all stages and returns metrics", async () => {
    const sideEffectCalls: Array<{ selected: number; filtered: number }> = [];

    const pipeline = new CandidatePipeline<TestQuery, TestCandidate>(
      {
        queryHydrators: [
          {
            name: "query",
            enable: () => true,
            hydrate: async () => ({ hydrated: true }),
            update: (query, hydrated) => Object.assign(query, hydrated),
          },
        ],
        sources: [
          {
            name: "source",
            enable: () => true,
            getCandidates: async () => [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
          },
        ],
        hydrators: [
          {
            name: "hydrator",
            enable: () => true,
            hydrate: async (_query, candidates) => candidates.map(() => ({ hydrated: true })),
            updateAll: (candidates, hydrated) => {
              candidates.forEach((candidate, index) => {
                Object.assign(candidate, hydrated[index]);
              });
            },
          },
        ],
        filters: [
          {
            name: "filter",
            enable: () => true,
            filter: async (_query, candidates, _context: PipelineContext) => {
              const kept = candidates.filter((candidate) => candidate.id !== "c3");
              const removed = candidates.filter((candidate) => candidate.id === "c3");
              return { kept, removed };
            },
          },
        ],
        scorers: [
          {
            name: "scorer",
            weight: 1,
            enable: () => true,
            score: async () => [0.2, 0.8],
            updateAll: (candidates, scores) => {
              candidates.forEach((candidate, index) => {
                candidate.score = (candidate.score ?? 0) + scores[index];
              });
            },
          },
        ],
        selector: {
          name: "selector",
          enable: () => true,
          select: (_query, candidates) =>
            candidates.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
        },
        postSelectionHydrators: [
          {
            name: "post",
            enable: () => true,
            hydrate: async (_query, candidates) => candidates.map(() => ({ postHydrated: true })),
            updateAll: (candidates, hydrated) => {
              candidates.forEach((candidate, index) => {
                Object.assign(candidate, hydrated[index]);
              });
            },
          },
        ],
        postSelectionFilters: [
          {
            name: "post-filter",
            enable: () => true,
            filter: async (_query, candidates) => {
              const kept = candidates.filter((candidate) => candidate.id !== "c2");
              const removed = candidates.filter((candidate) => candidate.id === "c2");
              return { kept, removed };
            },
          },
        ],
        sideEffects: [
          {
            name: "side-effect",
            enable: () => true,
            run: async (input) => {
              sideEffectCalls.push({
                selected: input.selectedCandidates.length,
                filtered: input.filteredCandidates.length,
              });
            },
          },
        ],
      },
      { ...baseConfig, resultSize: 2 },
      createLogger(),
    );

    const result = await pipeline.execute({ requestId: "req-1" });

    expect(result.query.hydrated).toBe(true);
    expect(result.retrievedCandidates).toHaveLength(3);
    expect(result.filteredCandidates).toHaveLength(2);
    expect(result.selectedCandidates).toHaveLength(1);
    expect(result.metrics.candidateCounts).toEqual({
      sourced: 3,
      afterHydration: 3,
      afterFiltering: 2,
      selected: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sideEffectCalls).toEqual([{ selected: 1, filtered: 2 }]);
  });

  it("skips hydrator updates when result length mismatches", async () => {
    const pipeline = new CandidatePipeline<TestQuery, TestCandidate>(
      {
        queryHydrators: [],
        sources: [
          {
            name: "source",
            enable: () => true,
            getCandidates: async () => [{ id: "c1" }, { id: "c2" }],
          },
        ],
        hydrators: [
          {
            name: "hydrator",
            enable: () => true,
            hydrate: async () => [{ hydrated: true }],
            updateAll: (candidates, hydrated) => {
              candidates.forEach((candidate, index) => {
                Object.assign(candidate, hydrated[index]);
              });
            },
          },
        ],
        filters: [],
        scorers: [],
        selector: {
          name: "selector",
          enable: () => true,
          select: (_query, candidates) => candidates,
        },
        postSelectionHydrators: [],
        postSelectionFilters: [],
        sideEffects: [],
      },
      baseConfig,
      createLogger(),
    );

    const result = await pipeline.execute({ requestId: "req-2" });

    expect(result.selectedCandidates).toHaveLength(2);
    expect(result.selectedCandidates.every((candidate) => !candidate.hydrated)).toBe(true);
  });

  it("throws when a component fails and failOpen is false", async () => {
    const pipeline = new CandidatePipeline<TestQuery, TestCandidate>(
      {
        queryHydrators: [],
        sources: [
          {
            name: "source",
            enable: () => true,
            getCandidates: async () => {
              throw new Error("source failed");
            },
          },
        ],
        hydrators: [],
        filters: [],
        scorers: [],
        selector: {
          name: "selector",
          enable: () => true,
          select: (_query, candidates) => candidates,
        },
        postSelectionHydrators: [],
        postSelectionFilters: [],
        sideEffects: [],
      },
      { ...baseConfig, failOpen: false },
      createLogger(),
    );

    await expect(pipeline.execute({ requestId: "req-3" })).rejects.toThrow("source failed");
  });
});
