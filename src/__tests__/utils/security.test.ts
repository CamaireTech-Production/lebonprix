import { describe, it, expect } from 'vitest'
import { makeDefaultEmployeePassword } from '../../utils/security'

/**
 * Test pour démontrer la couverture de code
 * Ce test teste du code source réel, donc il apparaîtra dans le rapport de couverture
 */
describe('security utils - makeDefaultEmployeePassword', () => {
  it('should generate password with firstname and lastname', () => {
    const result = makeDefaultEmployeePassword('John', 'Doe')
    expect(result).toBe('John123Doe')
  })

  it('should handle empty names', () => {
    const result = makeDefaultEmployeePassword('', '')
    expect(result).toBe('123')
  })

  it('should handle single character names', () => {
    const result = makeDefaultEmployeePassword('A', 'B')
    expect(result).toBe('A123B')
  })

  it('should handle names with spaces', () => {
    const result = makeDefaultEmployeePassword('John Paul', 'Doe Smith')
    expect(result).toBe('John Paul123Doe Smith')
  })
})

