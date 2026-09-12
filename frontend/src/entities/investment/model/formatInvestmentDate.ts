// Parse calendar dates at midday so the displayed day does not shift with timezone.
export function formatInvestmentDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Por confirmar'
  return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(date).replaceAll('.', '')
}
