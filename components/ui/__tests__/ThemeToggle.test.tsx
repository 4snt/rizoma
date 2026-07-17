import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const setTheme = vi.fn()
let currentTheme = 'light'

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    setTheme.mockClear()
  })

  it('no tema claro, clicar alterna para escuro', async () => {
    currentTheme = 'light'
    render(<ThemeToggle />)
    await userEvent.click(screen.getByTitle('Alternar tema'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('no tema escuro, clicar alterna para claro', async () => {
    currentTheme = 'dark'
    render(<ThemeToggle />)
    await userEvent.click(screen.getByTitle('Alternar tema'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
