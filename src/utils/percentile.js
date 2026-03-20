const scoreToPercentile = [
  { minScore: 190, percentile: 99.9 },
  { minScore: 175, percentile: 99.5 },
  { minScore: 160, percentile: 99.0 },
  { minScore: 148, percentile: 98.0 },
  { minScore: 135, percentile: 97.0 },
  { minScore: 122, percentile: 95.0 },
  { minScore: 110, percentile: 92.0 },
  { minScore: 98,  percentile: 90.0 },
  { minScore: 85,  percentile: 85.0 },
  { minScore: 72,  percentile: 80.0 },
  { minScore: 60,  percentile: 75.0 },
  { minScore: 48,  percentile: 70.0 },
  { minScore: 36,  percentile: 60.0 },
  { minScore: 24,  percentile: 50.0 },
  { minScore: 12,  percentile: 40.0 },
  { minScore: 0,   percentile: 25.0 },
  { minScore: -Infinity, percentile: 10.0 },
];

export function getPercentile(score) {
  for (let i = 0; i < scoreToPercentile.length; i++) {
    if (score >= scoreToPercentile[i].minScore) {
      if (i === 0) return scoreToPercentile[0].percentile;
      const upper = scoreToPercentile[i - 1];
      const lower = scoreToPercentile[i];
      const range = upper.minScore - lower.minScore;
      const diff = score - lower.minScore;
      const pctRange = upper.percentile - lower.percentile;
      const interpolated = lower.percentile + (diff / range) * pctRange;
      return Math.round(interpolated * 100) / 100;
    }
  }
  return 10.0;
}
