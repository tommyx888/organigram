export const brandTokens = {
  colors: {
    navy: "#21394F",
    oliveGreen: "#949C58",
    lightGrey: "#E4E4E4",
    white: "#FFFFFF",
    orange: "#F06909",
    peach: "#FFAA60",
    pink: "#D4517E",
    steelBlue: "#75909C",
  },
  fonts: {
    display: "Wix Madefor Display, var(--font-display), sans-serif",
    body: "Quicksand, var(--font-quicksand), sans-serif",
    logo: "Nasalization-Regular",
  },
  positionTypeColors: {
    salaried: "#21394F",
    indirect: "#75909C",
    direct: "#F06909",
  },
  /** Colors for KAT (INDIR1, INDIR2, INDIR3, SAL) to differentiate in org chart. */
  katColors: {
    INDIR1: "#64748b",
    INDIR2: "#75909C",
    INDIR3: "#949C58",
    SAL: "#21394F",
  },
  node: {
    borderRadius: 24,
    shadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
} as const;

export type PositionType = keyof typeof brandTokens.positionTypeColors;
