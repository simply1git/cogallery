import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-ring"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun size={20} className="text-slate-600 dark:text-slate-400" />
      ) : (
        <Moon size={20} className="text-slate-600" />
      )}
    </button>
  )
}
