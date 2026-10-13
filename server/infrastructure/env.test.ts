import { describe, expect, it } from 'vitest'
import { envOption, envPresence, envValue } from './env'

describe('variáveis de ambiente', () => {
  it('aceita espaços, aspas e maiúsculas nas opções (erros comuns ao colar na Vercel)', () => {
    for (const raw of ['supabase', ' Supabase ', '"supabase"', "'SUPABASE'\n"]) {
      expect(envOption('DATA_SOURCE', { DATA_SOURCE: raw })).toBe('supabase')
    }
    expect(envOption('DATA_SOURCE', {})).toBe('')
  })

  it('limpa URLs e chaves sem mudar maiúsculas', () => {
    expect(envValue('SUPABASE_URL', { SUPABASE_URL: ' "https://Abc.supabase.co" ' })).toBe('https://Abc.supabase.co')
    expect(envValue('SUPABASE_URL', { SUPABASE_URL: '  ' })).toBeNull()
  })

  it('diagnóstico mostra só presença, nunca valores', () => {
    const presence = envPresence({ DATA_SOURCE: 'supabase', SUPABASE_SERVICE_ROLE_KEY: 'segredo' })
    expect(presence).toMatchObject({ DATA_SOURCE: true, SUPABASE_SERVICE_ROLE_KEY: true, SUPABASE_URL: false })
    expect(JSON.stringify(presence)).not.toContain('segredo')
  })
})
