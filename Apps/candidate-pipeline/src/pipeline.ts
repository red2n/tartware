/**
 * CandidatePipeline - The main pipeline executor.
 *
 * Orchestrates the execution of all pipeline stages:
 * 1. Query Hydration
 * 2. Candidate Sourcing
 * 3. Candidate Hydration
 * 4. Pre-Scoring Filters
 * 5. Scoring
 * 6. Selection
 * 7. Post-Selection Hydration
 * 8. Post-Selection Filters
 * 9. Side Effects (async)
 */

import { performance } from "node:perf_hooks";

import type { Logger } from "pino";

import type { Filter } from "./filter.js";
import type { Hydrator } from "./hydrator.js";
import type { QueryHydrator } from "./query-hydrator.js";
import type { Scorer } from "./scorer.js";
import type { Selector } from "./selector.js";
import type { SideEffect, SideEffectInput } from "./side-effect.js";
import type { Source } from "./source.js";
import {
  type ComponentMetric,
  type HasRequestId,
  type HasScore,
  type PipelineConfig,
  type PipelineContext,
  type PipelineMetrics,
  type PipelineResult,
  PipelineStage,
} from "./types.js";

/**
 * Pipeline component configuration.
 */
export interface PipelineComponents<Q extends HasRequestId, C extends HasScore> {
  queryHydrators: QueryHydrator<Q>[];
  sources: Source<Q, C>[];
  hydrators: Hydrator<Q, C>[];
  filters: Filter<Q, C>[];
  scorers: Scorer<Q, C>[];
  selector: Selector<Q, C>;
  postSelectionHydrators: Hydrator<Q, C>[];
  postSelectionFilters: Filter<Q, C>[];
  sideEffects: SideEffect<Q, C>[];
}

/**
 * The main candidate pipeline executor.
 */
export class CandidatePipeline<Q extends HasRequestId, C extends HasScore> {
  private readonly components: PipelineComponents<Q, C>;
  private readonly config: PipelineConfig;
  private readonly logger: Logger;

  constructor(components: PipelineComponents<Q, C>, config: PipelineConfig, logger: Logger) {
    this.components = components;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute the pipeline for the given query.
   */
  async execute(query: Q): Promise<PipelineResult<Q, C>> {
    const startTime = performance.now();
    const context: PipelineContext = {
      logger: this.logger.child({ requestId: query.requestId }),
      startTime,
    };

    const metrics: PipelineMetrics = {
      totalDurationMs: 0,
      stageDurations: {},
      candidateCounts: {
        sourced: 0,
        afterHydration: 0,
        afterFiltering: 0,
        selected: 0,
      },
      componentMetrics: [],
    };

    try {
      // Stage 1: Query Hydration
      const hydratedQuery = await this.hydrateQuery(query, context, metrics);

      // Stage 2: Candidate Sourcing
      let candidates = await this.fetchCandidates(hydratedQuery, context, metrics);
      metrics.candidateCounts.sourced = candidates.length;

      // Stage 3: Candidate Hydration
      candidates = await this.hydrateCandidates(hydratedQuery, candidates, context, metrics);
      metrics.candidateCounts.afterHydration = candidates.length;

      // Stage 4: Pre-Scoring Filters
      const { kept: filteredCandidates, removed: preFilterRemoved } = await this.filterCandidates(
        hydratedQuery,
        candidates,
        this.components.filters,
        PipelineStage.Filter,
        context,
        metrics,
      );
      metrics.candidateCounts.afterFiltering = filteredCandidates.length;

      // Stage 5: Scoring
      const scoredCandidates = await this.scoreCandidates(
        hydratedQuery,
        filteredCandidates,
        context,
        metrics,
      );

      // Stage 6: Selection
      let selectedCandidates = this.selectCandidates(
        hydratedQuery,
        scoredCandidates,
        context,
        metrics,
      );

      // Stage 7: Post-Selection Hydration
      selectedCandidates = await this.hydratePostSelection(
        hydratedQuery,
        selectedCandidates,
        context,
        metrics,
      );

      // Stage 8: Post-Selection Filters
      const { kept: finalCandidates, removed: postFilterRemoved } = await this.filterCandidates(
        hydratedQuery,
        selectedCandidates,
        this.components.postSelectionFilters,
        PipelineStage.PostSelectionFilter,
        context,
        metrics,
      );

      // Truncate to result size
      const result = finalCandidates.slice(0, this.config.resultSize);
      metrics.candidateCounts.selected = result.length;

      // Combine all filtered candidates
      const allFiltered = [...preFilterRemoved, ...postFilterRemoved];

      // Stage 9: Side Effects (fire and forget)
      this.runSideEffects(
        { query: hydratedQuery, selectedCandidates: result, filteredCandidates: allFiltered },
        context,
        metrics,
      );

      // Calculate total duration
      metrics.totalDurationMs = performance.now() - startTime;

      context.logger.info(
        {
          durationMs: metrics.totalDurationMs,
          sourced: metrics.candidateCounts.sourced,
          filtered: allFiltered.length,
          selected: result.length,
        },
        "Pipeline completed",
      );

      return {
        query: hydratedQuery,
        retrievedCandidates: candidates,
        filteredCandidates: allFiltered,
        selectedCandidates: result,
        metrics,
      };
    } catch (error) {
      metrics.totalDurationMs = performance.now() - startTime;
      context.logger.error({ error, metrics }, "Pipeline failed");
      throw error;
    }
  }

  /**
   * Run all query hydrators in parallel.
   */
  private async hydrateQuery(
    query: Q,
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<Q> {
    const stageStart = performance.now();
    const enabledHydrators = this.components.queryHydrators.filter((h) => h.enable(query));

    if (enabledHydrators.length === 0) {
      return query;
    }

    const hydratedQuery = { ...query } as Q;
    const results = await Promise.allSettled(
      enabledHydrators.map(async (hydrator) => {
        const componentStart = performance.now();
        try {
          const result = await hydrator.hydrate(hydratedQuery, context);
          metrics.componentMetrics.push({
            stage: PipelineStage.QueryHydrator,
            name: hydrator.name,
            durationMs: performance.now() - componentStart,
            success: true,
          });
          return { hydrator, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          metrics.componentMetrics.push({
            stage: PipelineStage.QueryHydrator,
            name: hydrator.name,
            durationMs: performance.now() - componentStart,
            success: false,
            error: errorMessage,
          });
          context.logger.error({ error, hydrator: hydrator.name }, "Query hydrator failed");
          if (!this.config.failOpen) throw error;
          return null;
        }
      }),
    );

    // Re-throw the first rejection when failOpen is false
    if (!this.config.failOpen) {
      const rejection = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (rejection) throw rejection.reason;
    }

    // Apply successful hydrations
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        result.value.hydrator.update(hydratedQuery, result.value.result);
      }
    }

    metrics.stageDurations[PipelineStage.QueryHydrator] = performance.now() - stageStart;
    return hydratedQuery;
  }

  /**
   * Run all sources in parallel and collect candidates.
   */
  private async fetchCandidates(
    query: Q,
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<C[]> {
    const stageStart = performance.now();
    const enabledSources = this.components.sources.filter((s) => s.enable(query));

    if (enabledSources.length === 0) {
      context.logger.warn("No sources enabled for query");
      return [];
    }

    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        const componentStart = performance.now();
        try {
          const candidates = await source.getCandidates(query, context);
          const metric: ComponentMetric = {
            stage: PipelineStage.Source,
            name: source.name,
            durationMs: performance.now() - componentStart,
            success: true,
            metadata: { candidateCount: candidates.length },
          };
          metrics.componentMetrics.push(metric);
          context.logger.debug(
            { source: source.name, count: candidates.length },
            "Source fetched candidates",
          );
          return candidates;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          metrics.componentMetrics.push({
            stage: PipelineStage.Source,
            name: source.name,
            durationMs: performance.now() - componentStart,
            success: false,
            error: errorMessage,
          });
          context.logger.error({ error, source: source.name }, "Source failed");
          if (!this.config.failOpen) throw error;
          return [];
        }
      }),
    );

    // Re-throw the first rejection when failOpen is false
    if (!this.config.failOpen) {
      const rejection = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (rejection) throw rejection.reason;
    }

    // Collect all successful results
    const candidates: C[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        candidates.push(...result.value);
      }
    }

    metrics.stageDurations[PipelineStage.Source] = performance.now() - stageStart;
    return candidates;
  }

  /**
   * Run all hydrators in parallel.
   */
  private async hydrateCandidates(
    query: Q,
    candidates: C[],
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<C[]> {
    return this.runHydrators(
      query,
      candidates,
      this.components.hydrators,
      PipelineStage.Hydrator,
      context,
      metrics,
    );
  }

  /**
   * Run post-selection hydrators in parallel.
   */
  private async hydratePostSelection(
    query: Q,
    candidates: C[],
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<C[]> {
    return this.runHydrators(
      query,
      candidates,
      this.components.postSelectionHydrators,
      PipelineStage.PostSelectionHydrator,
      context,
      metrics,
    );
  }

  /**
   * Shared hydrator execution logic.
   */
  private async runHydrators(
    query: Q,
    candidates: C[],
    hydrators: Hydrator<Q, C>[],
    stage: PipelineStage,
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<C[]> {
    const stageStart = performance.now();
    const enabledHydrators = hydrators.filter((h) => h.enable(query));

    if (enabledHydrators.length === 0 || candidates.length === 0) {
      return candidates;
    }

    const hydratedCandidates = candidates.map((c) => ({ ...c })) as C[];
    const expectedLen = hydratedCandidates.length;

    const results = await Promise.allSettled(
      enabledHydrators.map(async (hydrator) => {
        const componentStart = performance.now();
        try {
          const result = await hydrator.hydrate(query, hydratedCandidates, context);
          metrics.componentMetrics.push({
            stage,
            name: hydrator.name,
            durationMs: performance.now() - componentStart,
            success: true,
          });
          return { hydrator, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          metrics.componentMetrics.push({
            stage,
            name: hydrator.name,
            durationMs: performance.now() - componentStart,
            success: false,
            error: errorMessage,
          });
          context.logger.error({ error, hydrator: hydrator.name, stage }, "Hydrator failed");
          if (!this.config.failOpen) throw error;
          return null;
        }
      }),
    );

    // Re-throw the first rejection when failOpen is false
    if (!this.config.failOpen) {
      const rejection = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (rejection) throw rejection.reason;
    }

    // Apply successful hydrations
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const { hydrator, result: hydrated } = result.value;
        if (hydrated.length === expectedLen) {
          hydrator.updateAll(hydratedCandidates, hydrated);
        } else {
          context.logger.warn(
            {
              hydrator: hydrator.name,
              expected: expectedLen,
              got: hydrated.length,
            },
            "Hydrator result length mismatch, skipping",
          );
        }
      }
    }

    metrics.stageDurations[stage] = performance.now() - stageStart;
    return hydratedCandidates;
  }

  /**
   * Run filters sequentially.
   */
  private async filterCandidates(
    query: Q,
    candidates: C[],
    filters: Filter<Q, C>[],
    stage: PipelineStage,
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<{ kept: C[]; removed: C[] }> {
    const stageStart = performance.now();
    const enabledFilters = filters.filter((f) => f.enable(query));

    let current = candidates;
    const allRemoved: C[] = [];

    for (const filter of enabledFilters) {
      const componentStart = performance.now();
      try {
        const result = await filter.filter(query, current, context);
        metrics.componentMetrics.push({
          stage,
          name: filter.name,
          durationMs: performance.now() - componentStart,
          success: true,
          metadata: {
            kept: result.kept.length,
            removed: result.removed.length,
          },
        });
        current = result.kept;
        allRemoved.push(...result.removed);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        metrics.componentMetrics.push({
          stage,
          name: filter.name,
          durationMs: performance.now() - componentStart,
          success: false,
          error: errorMessage,
        });
        context.logger.error({ error, filter: filter.name, stage }, "Filter failed");
        if (!this.config.failOpen) throw error;
        // On fail-open, keep all candidates
      }
    }

    context.logger.debug(
      { stage, kept: current.length, removed: allRemoved.length },
      "Filtering complete",
    );

    metrics.stageDurations[stage] = performance.now() - stageStart;
    return { kept: current, removed: allRemoved };
  }

  /**
   * Run scorers sequentially (order matters for some scorers).
   */
  private async scoreCandidates(
    query: Q,
    candidates: C[],
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): Promise<C[]> {
    const stageStart = performance.now();
    const enabledScorers = this.components.scorers.filter((s) => s.enable(query));

    if (enabledScorers.length === 0 || candidates.length === 0) {
      return candidates;
    }

    const scoredCandidates = candidates.map((c) => ({ ...c })) as C[];
    const expectedLen = scoredCandidates.length;

    for (const scorer of enabledScorers) {
      const componentStart = performance.now();
      try {
        const scores = await scorer.score(query, scoredCandidates, context);
        if (scores.length === expectedLen) {
          scorer.updateAll(scoredCandidates, scores);
          metrics.componentMetrics.push({
            stage: PipelineStage.Scorer,
            name: scorer.name,
            durationMs: performance.now() - componentStart,
            success: true,
          });
        } else {
          context.logger.warn(
            {
              scorer: scorer.name,
              expected: expectedLen,
              got: scores.length,
            },
            "Scorer result length mismatch, skipping",
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        metrics.componentMetrics.push({
          stage: PipelineStage.Scorer,
          name: scorer.name,
          durationMs: performance.now() - componentStart,
          success: false,
          error: errorMessage,
        });
        context.logger.error({ error, scorer: scorer.name }, "Scorer failed");
        if (!this.config.failOpen) throw error;
      }
    }

    metrics.stageDurations[PipelineStage.Scorer] = performance.now() - stageStart;
    return scoredCandidates;
  }

  /**
   * Run the selector.
   */
  private selectCandidates(
    query: Q,
    candidates: C[],
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): C[] {
    const stageStart = performance.now();
    const selector = this.components.selector;

    if (!selector.enable(query)) {
      return candidates;
    }

    const componentStart = performance.now();
    try {
      const result = selector.select(query, candidates);
      metrics.componentMetrics.push({
        stage: PipelineStage.Selector,
        name: selector.name,
        durationMs: performance.now() - componentStart,
        success: true,
        metadata: { selected: result.length },
      });
      metrics.stageDurations[PipelineStage.Selector] = performance.now() - stageStart;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      metrics.componentMetrics.push({
        stage: PipelineStage.Selector,
        name: selector.name,
        durationMs: performance.now() - componentStart,
        success: false,
        error: errorMessage,
      });
      context.logger.error({ error, selector: selector.name }, "Selector failed");
      if (!this.config.failOpen) throw error;
      return candidates;
    }
  }

  /**
   * Run side effects asynchronously (fire and forget).
   */
  private runSideEffects(
    input: SideEffectInput<Q, C>,
    context: PipelineContext,
    metrics: PipelineMetrics,
  ): void {
    const enabledEffects = this.components.sideEffects.filter((se) => se.enable(input.query));

    if (enabledEffects.length === 0) {
      return;
    }

    // Fire and forget - don't await
    Promise.allSettled(
      enabledEffects.map(async (effect) => {
        const componentStart = performance.now();
        try {
          await effect.run(input, context);
          metrics.componentMetrics.push({
            stage: PipelineStage.SideEffect,
            name: effect.name,
            durationMs: performance.now() - componentStart,
            success: true,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          metrics.componentMetrics.push({
            stage: PipelineStage.SideEffect,
            name: effect.name,
            durationMs: performance.now() - componentStart,
            success: false,
            error: errorMessage,
          });
          context.logger.error({ error, effect: effect.name }, "Side effect failed");
        }
      }),
    ).catch(() => {
      // Ignore - side effects are best-effort
    });
  }
}
