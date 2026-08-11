/** A field a record can be searched by. Arrays (tags, amenities) are flattened. */
type SearchField = string | number | null | undefined | readonly (string | null | undefined)[];

/**
 * Splits a query into lower-cased terms. Empty query → no terms, which callers
 * treat as "match everything".
 */
export const searchTerms = (query: string): string[] =>
	query.toLowerCase().trim().split(/\s+/).filter(Boolean);

/**
 * True when every term in the query appears in at least one of the fields.
 *
 * Screens used to test `field.includes(query)` with the whole query string, so
 * a natural search like "king room" matched nothing: no single field contains
 * that exact substring, even though the room is a "Cityline King" on the
 * "Rooms" screen. Matching term-by-term across the record's combined text is
 * what people expect — every word must appear somewhere, in any order, in any
 * field.
 *
 * AND across terms (narrowing as you type), OR across fields (a term may match
 * any one of them).
 */
export const matchesSearch = (query: string, ...fields: SearchField[]): boolean => {
	const terms = searchTerms(query);
	if (terms.length === 0) return true;

	const haystack = fields
		.flat()
		.filter((value): value is string | number => value !== null && value !== undefined)
		.join(" ")
		.toLowerCase();

	return terms.every((term) => haystack.includes(term));
};

/** True when at least one term appears in the fields — the relaxed tier. */
export const anyTermMatches = (query: string, ...fields: SearchField[]): boolean => {
	const terms = searchTerms(query);
	if (terms.length === 0) return false;

	const haystack = fields
		.flat()
		.filter((value): value is string | number => value !== null && value !== undefined)
		.join(" ")
		.toLowerCase();

	return terms.some((term) => haystack.includes(term));
};

/**
 * Filters a list by a search query, narrowing where it can and relaxing where
 * it must.
 *
 * Requiring every term (AND) is right when the terms describe the record —
 * "cityline king" should not also match a Garden Suite. But people type the
 * screen's own name too: searching "king room" on Rooms is natural, and no
 * room record contains the word "room", so a strict AND returns nothing and
 * the search looks broken.
 *
 * So: match all terms first, and only if that finds nothing fall back to
 * matching any term. Precise queries stay precise, and a query carrying an
 * extra word still finds the thing the user meant.
 */
export const filterBySearch = <T>(
	items: readonly T[],
	query: string,
	fields: (item: T) => SearchField[],
): T[] => {
	const terms = searchTerms(query);
	if (terms.length === 0) return [...items];

	const haystackOf = (item: T): string =>
		fields(item)
			.flat()
			.filter((value): value is string | number => value !== null && value !== undefined)
			.join(" ")
			.toLowerCase();

	const strict = items.filter((item) => {
		const haystack = haystackOf(item);
		return terms.every((term) => haystack.includes(term));
	});
	if (strict.length > 0) return strict;

	return items.filter((item) => {
		const haystack = haystackOf(item);
		return terms.some((term) => haystack.includes(term));
	});
};

/**
 * How well a record's primary label matches, for ordering results — lower is
 * better, -1 means no match. Mirrors matchesSearch's term semantics so a result
 * can never rank as "no match" while still being included by the filter.
 *
 * 0 exact · 1 label starts with the query · 2 all terms present in the label
 * 5 some terms present (the relaxed tier, ranked below every exact tier)
 */
export const labelMatchRank = (query: string, label: string): number => {
	const terms = searchTerms(query);
	if (terms.length === 0) return -1;

	const value = label.toLowerCase();
	const joined = terms.join(" ");
	if (value === joined) return 0;
	if (value.startsWith(joined)) return 1;
	return terms.every((term) => value.includes(term)) ? 2 : -1;
};
