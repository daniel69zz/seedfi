export const routes = {
  marketplace: '/',
  opportunity: (id: string) => `/opportunities/${encodeURIComponent(id)}`,
} as const
