/**
 * Core types for the candidate pipeline framework.
 */

import type { Logger } from "pino";

/**
 * Pipeline execution stages for logging and metrics.
 */
export enum PipelineStage {
  QueryHydrator = "query_hydrator",
  Source = "source",
  Hydrator = "hydrator",
  PostSelectionHydrator = "post_selection_hydrator",
  Filter = "filter",
  PostSelectionFilter = "post_selection_filter",
  Scorer = "scorer",
  Selector = "selector",
  SideEffect = "side_effect",
}

/**
 * Base interface for queries that flow through the pipeline.
 * Queries must have a request ID for tracing/logging.
 */
export interface HasRequestId {
  requestId: string;
}

/**
 * Base interface for candidates that flow through the pipeline.
 * Candidates accumulate scores as they pass through scorers.
 */
export interface HasScore {
  score?: number;
  scores?: Record<string, number>;
}

/**
 * Result of a filter operation.
 */
export interface FilterResult<C> {
  /** Candidates that passed the filter */
  kept: C[];
  /** Candidates that were removed by the filter */
  removed: C[];
}

/**
 * Result of pipeline execution.
 */
export interface PipelineResult<Q, C> {
  /** The hydrated query after all query hydrators ran */
  query: Q;
  /** All candidates retrieved from sources (before filtering) */
  retrievedCandidates: C[];
  /** Candidates that were removed by filters */
  filteredCandidates: C[];
  /** Final selected candidates (the pipeline output) */
  selectedCandidates: C[];
  /** Execution metrics */
  metrics: PipelineMetrics;
}

/**
 * Metrics collected during pipeline execution.
 */
export interface PipelineMetrics {
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Time spent in each stage */
  stageDurations: Record<string, number>;
  /** Candidate counts at each stage */
  candidateCounts: {
    sourced: number;
    afterHydration: number;
    afterFiltering: number;
    selected: number;
  };
  /** Per-component metrics */
  componentMetrics: ComponentMetric[];
}

/**
 * Metrics for a single pipeline component.
 */
export interface ComponentMetric {
  stage: PipelineStage;
  name: string;
  durationMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to pipeline components during execution.
 */
export interface PipelineContext {
  logger: Logger;
  /** Start time for latency tracking */
  startTime: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Configuration for pipeline execution.
 */
export interface PipelineConfig {
  /** Maximum number of candidates to return */
  resultSize: number;
  /** Whether to continue on component errors (fail-open) */
  failOpen: boolean;
  /** Timeout for the entire pipeline in milliseconds */
  timeoutMs?: number;
  /** Enable parallel execution where possible */
  enableParallelExecution: boolean;
}
