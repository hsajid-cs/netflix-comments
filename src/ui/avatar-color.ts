const COLORS = ['#e7b4a0', '#abc5e7', '#c6b4e6', '#a9d9c1', '#dfc78e']

export function avatarColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}
