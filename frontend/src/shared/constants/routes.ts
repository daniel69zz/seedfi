export const routes = {
  marketplace: '/',
  investments: '/investments',
  portfolio: '/portfolio',
  profile: '/profile',
  opportunity: (id: string) => `/opportunities/${encodeURIComponent(id)}`,
} as const
