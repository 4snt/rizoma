import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Desmonta a árvore React entre testes para não vazar DOM de um teste no outro.
afterEach(() => {
  cleanup()
})
