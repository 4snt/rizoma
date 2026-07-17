import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/components/ui/Footer'

// next/image precisa do runtime do Next; no jsdom trocamos por um <img> simples.
vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

describe('Footer', () => {
  it('renderiza os três logos institucionais com texto alternativo', () => {
    render(<Footer />)
    expect(screen.getByAltText(/DECOM/i)).toBeInTheDocument()
    expect(screen.getByAltText(/NEBIM/i)).toBeInTheDocument()
    expect(screen.getByAltText(/INOVAHERB/i)).toBeInTheDocument()
  })

  it('é um elemento <footer> (landmark contentinfo)', () => {
    const { container } = render(<Footer />)
    expect(container.querySelector('footer')).not.toBeNull()
  })
})
