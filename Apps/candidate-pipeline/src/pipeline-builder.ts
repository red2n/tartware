/**
 * PipelineBuilder - Fluent builder for constructing pipelines.
 *
 * @example
 * ```typescript
 * const pipeline = new PipelineBuilder<RoomQuery, RoomCandidate>(logger)
 *   .addQueryHydrator(new GuestHistoryHydrator())
 *   .addSource(new AvailableRoomsSource())
 *   .addSource(new SimilarRoomsSource())
 *   .addHydrator(new RoomDetailsHydrator())
 *   .addFilter(new MaintenanceFilter())
 *   .addScorer(new PreferenceScorer())
 *   .setSelector(new TopKScoreSelector())
 *   .setResultSize(10)
 *   .build();
 * ```
 */

import type { Logger } from "pino";

import type { Filter } from "./filter.js";
import type { Hydrator } from "./hydrator.js";
import { CandidatePipeline, type PipelineComponents } from "./pipeline.js";
import type { QueryHydrator } from "./query-hydrator.js";
import type { Scorer } from "./scorer.js";
import type { Selector } from "./selector.js";
import { TopKScoreSelector } from "./selector.js";
import type { SideEffect } from "./side-effect.js";
import type { Source } from "./source.js";
import type { HasRequestId, HasScore, PipelineConfig } from "./types.js";

/**
 * Fluent builder for constructing candidate pipelines.
 */
export class PipelineBuilder<Q extends HasRequestId, C extends HasScore> {
  private logger: Logger;
  private queryHydrators: QueryHydrator<Q>[] = [];
  private sources: Source<Q, C>[] = [];
  private hydrators: Hydrator<Q, C>[] = [];
  private filters: Filter<Q, C>[] = [];
  private scorers: Scorer<Q, C>[] = [];
  private selector: Selector<Q, C> = new TopKScoreSelector<Q, C>();
  private postSelectionHydrators: Hydrator<Q, C>[] = [];
  private postSelectionFilters: Filter<Q, C>[] = [];
  private sideEffects: SideEffect<Q, C>[] = [];
  private config: PipelineConfig = {
    resultSize: 10,
    failOpen: true,
    enableParallelExecution: true,
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Add a query hydrator to enrich the query before sourcing.
   */
  addQueryHydrator(hydrator: QueryHydrator<Q>): this {
    this.queryHydrators.push(hydrator);
    return this;
  }

  /**
   * Add multiple query hydrators.
   */
  addQueryHydrators(hydrators: QueryHydrator<Q>[]): this {
    this.queryHydrators.push(...hydrators);
    return this;
  }

  /**
   * Add a candidate source.
   */
  addSource(source: Source<Q, C>): this {
    this.sources.push(source);
    return this;
  }

  /**
   * Add multiple candidate sources.
   */
  addSources(sources: Source<Q, C>[]): this {
    this.sources.push(...sources);
    return this;
  }

  /**
   * Add a candidate hydrator.
   */
  addHydrator(hydrator: Hydrator<Q, C>): this {
    this.hydrators.push(hydrator);
    return this;
  }

  /**
   * Add multiple candidate hydrators.
   */
  addHydrators(hydrators: Hydrator<Q, C>[]): this {
    this.hydrators.push(...hydrators);
    return this;
  }

  /**
   * Add a filter.
   */
  addFilter(filter: Filter<Q, C>): this {
    this.filters.push(filter);
    return this;
  }

  /**
   * Add multiple filters.
   */
  addFilters(filters: Filter<Q, C>[]): this {
    this.filters.push(...filters);
    return this;
  }

  /**
   * Add a scorer.
   */
  addScorer(scorer: Scorer<Q, C>): this {
    this.scorers.push(scorer);
    return this;
  }

  /**
   * Add multiple scorers.
   */
  addScorers(scorers: Scorer<Q, C>[]): this {
    this.scorers.push(...scorers);
    return this;
  }

  /**
   * Set the selector (replaces any existing selector).
   */
  setSelector(selector: Selector<Q, C>): this {
    this.selector = selector;
    return this;
  }

  /**
   * Add a post-selection hydrator.
   */
  addPostSelectionHydrator(hydrator: Hydrator<Q, C>): this {
    this.postSelectionHydrators.push(hydrator);
    return this;
  }

  /**
   * Add a post-selection filter.
   */
  addPostSelectionFilter(filter: Filter<Q, C>): this {
    this.postSelectionFilters.push(filter);
    return this;
  }

  /**
   * Add a side effect.
   */
  addSideEffect(effect: SideEffect<Q, C>): this {
    this.sideEffects.push(effect);
    return this;
  }

  /**
   * Add multiple side effects.
   */
  addSideEffects(effects: SideEffect<Q, C>[]): this {
    this.sideEffects.push(...effects);
    return this;
  }

  /**
   * Set the maximum number of candidates to return.
   */
  setResultSize(size: number): this {
    this.config.resultSize = size;
    return this;
  }

  /**
   * Set whether to continue on component errors.
   */
  setFailOpen(failOpen: boolean): this {
    this.config.failOpen = failOpen;
    return this;
  }

  /**
   * Set the pipeline timeout in milliseconds.
   */
  setTimeout(timeoutMs: number): this {
    this.config.timeoutMs = timeoutMs;
    return this;
  }

  /**
   * Enable or disable parallel execution.
   */
  setParallelExecution(enabled: boolean): this {
    this.config.enableParallelExecution = enabled;
    return this;
  }

  /**
   * Set the full pipeline configuration.
   */
  setConfig(config: Partial<PipelineConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Build the pipeline.
   *
   * @throws Error if no sources are configured
   */
  build(): CandidatePipeline<Q, C> {
    if (this.sources.length === 0) {
      throw new Error("Pipeline requires at least one source");
    }

    const components: PipelineComponents<Q, C> = {
      queryHydrators: this.queryHydrators,
      sources: this.sources,
      hydrators: this.hydrators,
      filters: this.filters,
      scorers: this.scorers,
      selector: this.selector,
      postSelectionHydrators: this.postSelectionHydrators,
      postSelectionFilters: this.postSelectionFilters,
      sideEffects: this.sideEffects,
    };

    return new CandidatePipeline(components, this.config, this.logger);
  }
}
