export const reviewReadRateLimit = { max: 60, timeWindow: '1 minute' } as const;
export const reviewWriteRateLimit = { max: 15, timeWindow: '1 minute' } as const;
export const reviewVoteRateLimit = { max: 30, timeWindow: '1 minute' } as const;
