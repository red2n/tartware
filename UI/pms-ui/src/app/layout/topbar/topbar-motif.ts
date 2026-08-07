/**
 * Title bar watermark — the scene, as data.
 *
 * A hospitality landscape composed the way a photograph is rather than laid
 * out as a row of glyphs. The bar's bottom edge is the land; everything
 * stands on it or flies above it. Read as one journey: the ridge, the road
 * and the coast on the left, then the resort, its water and the table on the
 * right, under a low sun.
 *
 * It is two scenes, not one, because the search field is centred, opaque and
 * 460px wide at every viewport — anything composed through the middle of the
 * bar is permanently sliced by it. So the landscape is framed to the clear
 * air on either side of that field, and the field reads as the gap in a
 * panorama rather than as a box dropped on top of one.
 *
 * Depth comes from three cues working together, and the positions below are
 * tuned for all three:
 *   - `plane` decides the ink — distance cools, fades and softens a mark
 *     (see topbar-motif.scss). Marks are listed far to near, which is also
 *     the order they paint in, so nearer planes occlude farther ones.
 *   - `size` shrinks with distance.
 *   - `x` is deliberate about overlap: near marks are placed a hair off the
 *     far mass behind them (the car on the ridge, the bed against the tower)
 *     so the planes read as stacked rather than as one line of icons.
 *
 * Ligatures are all from the classic Material Icons set the app loads.
 */

/** How far back a mark sits, which is all that decides how it is inked. */
export type MotifPlane = "sky" | "far" | "mid" | "near";

/**
 * Narrowest wing the mark survives. Wings are carved out of what the brand
 * lockup, the search field and the right-hand controls leave behind, so they
 * shrink much faster than the window does: 1 holds the composition on its
 * own, 2 is the second rank, 3 is detail only wide windows have room for.
 */
export type MotifTier = 1 | 2 | 3;

export interface MotifMark {
	/** Material Icons ligature. */
	readonly icon: string;
	/** Position across the wing, 0 (left edge) to 100 (right edge). */
	readonly x: number;
	/** Glyph size in px — larger reads as nearer. */
	readonly size: number;
	/** Height above the land in px; 0 stands on the horizon. */
	readonly lift: number;
	readonly plane: MotifPlane;
	readonly tier: MotifTier;
	/** Degrees clockwise. Only the aircraft banks. */
	readonly tilt?: number;
}

/**
 * Left wing — getting there. A ridge massed against the brand lockup, the
 * road running out of it, and the coast waiting at the far end.
 */
export const TOPBAR_MOTIF_LEFT: readonly MotifMark[] = [
	{ icon: "cloud", x: 12, size: 11, lift: 25, plane: "sky", tier: 3 },
	{ icon: "flight", x: 52, size: 13, lift: 27, plane: "sky", tier: 1, tilt: 40 },
	{ icon: "cloud", x: 70, size: 11, lift: 27, plane: "sky", tier: 3 },

	{ icon: "filter_hdr", x: 7, size: 26, lift: 0, plane: "far", tier: 2 },
	{ icon: "terrain", x: 20, size: 30, lift: 0, plane: "far", tier: 1 },
	{ icon: "landscape", x: 36, size: 19, lift: 0, plane: "far", tier: 3 },

	{ icon: "forest", x: 13, size: 19, lift: 0, plane: "mid", tier: 2 },
	{ icon: "hiking", x: 46, size: 15, lift: 0, plane: "mid", tier: 3 },
	{ icon: "waves", x: 84, size: 18, lift: 0, plane: "mid", tier: 1 },
	/* Lifted onto the swell, and after the water in the list so it paints over. */
	{ icon: "sailing", x: 86, size: 14, lift: 6, plane: "mid", tier: 3 },

	{ icon: "signpost", x: 3, size: 18, lift: 0, plane: "near", tier: 3 },
	{ icon: "directions_car", x: 24, size: 23, lift: 0, plane: "near", tier: 1 },
	{ icon: "luggage", x: 38, size: 21, lift: 0, plane: "near", tier: 2 },
	/* On the coast road, holding the long open stretch before the water. */
	{ icon: "pedal_bike", x: 62, size: 19, lift: 0, plane: "near", tier: 2 },
];

/**
 * Right wing — being there. The property holds the left of the wing where the
 * eye arrives, the water and the parasol sit mid-frame, and the table closes
 * the scene under the controls. The sun at 13% is what the wing's background
 * bloom is centred on, so the two stay in register.
 */
export const TOPBAR_MOTIF_RIGHT: readonly MotifMark[] = [
	{ icon: "wb_sunny", x: 13, size: 15, lift: 24, plane: "sky", tier: 1 },
	{ icon: "cloud", x: 50, size: 11, lift: 27, plane: "sky", tier: 3 },
	{ icon: "cloud", x: 90, size: 10, lift: 26, plane: "sky", tier: 2 },

	{ icon: "terrain", x: 8, size: 22, lift: 0, plane: "far", tier: 2 },
	{ icon: "filter_hdr", x: 31, size: 16, lift: 0, plane: "far", tier: 3 },

	{ icon: "villa", x: 6, size: 21, lift: 0, plane: "mid", tier: 3 },
	{ icon: "apartment", x: 20, size: 28, lift: 0, plane: "mid", tier: 1 },
	{ icon: "holiday_village", x: 33, size: 19, lift: 0, plane: "mid", tier: 3 },
	{ icon: "pool", x: 45, size: 18, lift: 0, plane: "mid", tier: 2 },

	{ icon: "king_bed", x: 27, size: 22, lift: 0, plane: "near", tier: 1 },
	{ icon: "beach_access", x: 42, size: 25, lift: 0, plane: "near", tier: 1 },
	{ icon: "spa", x: 54, size: 15, lift: 0, plane: "near", tier: 3 },
	/* The table, grouped tight so it reads as one setting rather than as four
	   evenly spaced icons — the nightcap is the one set apart. */
	{ icon: "room_service", x: 65, size: 23, lift: 0, plane: "near", tier: 1 },
	{ icon: "restaurant", x: 72, size: 19, lift: 0, plane: "near", tier: 2 },
	{ icon: "local_cafe", x: 77, size: 16, lift: 0, plane: "near", tier: 3 },
	{ icon: "wine_bar", x: 87, size: 18, lift: 0, plane: "near", tier: 3 },
];
