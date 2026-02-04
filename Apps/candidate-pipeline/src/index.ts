/**
 * @tartware/candidate-pipeline
 *
 * A reusable framework for building recommendation pipelines.
 * Inspired by X's recommendation system architecture.
 *
 * The pipeline executes in stages:
 * 1. Query Hydration - Enrich the query with user context
 * 2. Candidate Sourcing - Fetch candidates from multiple sources
 * 3. Candidate Hydration - Enrich candidates with additional data
 * 4. Filtering - Remove ineligible candidates
 * 5. Scoring - Compute relevance scores
 * 6. Selection - Sort and select top-K candidates
 * 7. Post-Selection - Final validation and side effects
 */

export * from "./filter.js";
export * from "./hydrator.js";
export * from "./pipeline.js";
export * from "./pipeline-builder.js";
export * from "./query-hydrator.js";
export * from "./scorer.js";
export * from "./selector.js";
export * from "./side-effect.js";
export * from "./source.js";
export * from "./types.js";
