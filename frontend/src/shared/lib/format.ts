export function formatUsd(value: number, withCurrency = false) {
  const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  return withCurrency ? `${amount} USDT` : `$${amount}`
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(value)}%`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}
