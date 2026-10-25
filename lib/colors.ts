// Category colors. New categories get the next unused one; you can pick any of them for a category.
export const STARTER_COLORS = { Recipes: "#F08A4B", Events: "#4A7CF7", School: "#6AAA64", Home: "#B08968", Other: "#A3A3A8" };
// The first eight are used first for new categories and projects; the rest are there to pick.
export const PALETTE = [
  "#E0607E", "#9B6DE0", "#2BB3A6", "#E5B83B", "#5AA9E6", "#C7834F", "#7A8C3C", "#D46CC4",
  "#E5484D", "#F2A33A", "#46A758", "#12A594", "#3E63DD", "#6E56CF", "#8E8C99", "#B08968",
];
export const COLORS = [...Object.values(STARTER_COLORS), ...PALETTE];
