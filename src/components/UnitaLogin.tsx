'use client'

/**
 * Tela de login Unità — versão React (Vite, Next.js, com ou sem Tailwind).
 * Origem: Cadastro de Fornecedores (layout do Relatório de Aporte, com a marca Unità).
 *
 * Só desenha a tela. Os botões / formulário de entrar vêm como filhos, então o login
 * da ferramenta (Microsoft próprio, Supabase, e-mail e senha) continua exatamente como está.
 *
 * Uso:
 *   import { UnitaLogin, BotaoMicrosoft } from './UnitaLogin'
 *
 *   <UnitaLogin area="Suprimentos" ferramenta="Cadastro de fornecedores"
 *               descricao="Solicitação, homologação e gravação no UAU em um só fluxo.">
 *     <BotaoMicrosoft href="/api/auth/microsoft/start" />
 *   </UnitaLogin>
 *
 * Precisa só da pasta unita-login/ dentro de public/ (imagens + CSS): o componente carrega o CSS
 * de lá sozinho, então não há import a configurar nem mudança no CSS da ferramenta.
 */
import { useState, type ReactNode } from 'react'

export interface UnitaLoginProps {
  /** Linha pequena acima do nome da ferramenta (ex.: "Suprimentos", "Controladoria"). */
  area: string
  /** Nome da ferramenta, em destaque no painel da marca. */
  ferramenta: string
  /** Frase curta do painel da marca (some no celular). */
  descricao?: string
  /** Título do cartão. Padrão: "Bem-vindo". */
  titulo?: string
  /** Texto abaixo do título. */
  subtitulo?: ReactNode
  /** Mensagem de erro. Se não vier, usa ?erro= do endereço (padrão do Kit - Login Microsoft). */
  erro?: string | null
  /** Padrão: "Unità Engenharia · uso interno". */
  rodape?: string
  /** Pasta pública com as imagens. Padrão: "/unita-login". */
  pastaMarca?: string
  /** Botões / formulário de entrar da ferramenta. */
  children: ReactNode
}

export function UnitaLogin({
  area,
  ferramenta,
  descricao,
  titulo = 'Bem-vindo',
  subtitulo = 'Entre com a sua conta corporativa para acessar a ferramenta.',
  erro,
  rodape = 'Unità Engenharia · uso interno',
  pastaMarca = '/unita-login',
  children,
}: UnitaLoginProps) {
  const [erroDoEndereco] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('erro'),
  )
  const mensagem = erro === undefined ? erroDoEndereco : erro

  return (
    <>
      <link rel="stylesheet" href={`${pastaMarca}/unita-login.css`} />
      <div className="ul-login">
        <aside className="ul-marca">
          <img className="ul-padrao" src={`${pastaMarca}/pattern-un.png`} alt="" aria-hidden />
          <img className="ul-logo" src={`${pastaMarca}/logo-unita-white.png`} alt="Unità Engenharia" />
          <div className="ul-marca-texto">
            <p className="ul-sobretitulo">{area}</p>
            <h2>{ferramenta}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
        </aside>

        <section className="ul-acesso">
          <div className="ul-cartao">
            <p className="ul-sobretitulo">Unità · {area}</p>
            <h1>{titulo}</h1>
            <p className="ul-subtitulo">{subtitulo}</p>
            {mensagem && (
              <div className="ul-aviso" role="alert">
                {mensagem}
              </div>
            )}
            <div className="ul-conteudo">{children}</div>
          </div>
          <p className="ul-rodape">{rodape}</p>
        </section>
      </div>
    </>
  )
}

/**
 * Botão "Entrar com Microsoft 365".
 * - Trilha A (servidor próprio): passe `href` (padrão "/api/auth/microsoft/start").
 * - Trilha B (Supabase): passe `onClick` com o signInWithOAuth da ferramenta.
 */
export function BotaoMicrosoft({
  href = '/api/auth/microsoft/start',
  onClick,
  desativado,
  nota = 'Use sua conta corporativa da Unità.',
}: {
  href?: string
  onClick?: () => void | Promise<void>
  desativado?: boolean
  nota?: ReactNode
}) {
  const [indo, setIndo] = useState(false)
  const conteudo = indo ? (
    <>
      <span className="ul-girando" />
      Abrindo a Microsoft…
    </>
  ) : (
    <>
      <LogoMicrosoft />
      Entrar com Microsoft 365
    </>
  )

  return (
    <>
      {onClick ? (
        <button
          type="button"
          className="ul-botao"
          disabled={desativado || indo}
          onClick={async () => {
            setIndo(true)
            try {
              await onClick()
            } catch (e) {
              setIndo(false)
              throw e
            }
          }}
        >
          {conteudo}
        </button>
      ) : (
        <a
          className="ul-botao"
          href={href}
          aria-disabled={desativado || indo || undefined}
          onClick={() => setIndo(true)}
        >
          {conteudo}
        </a>
      )}
      {nota && <p className="ul-nota">{nota}</p>}
    </>
  )
}

/** Logo oficial da Microsoft (4 quadrados, cores da marca Microsoft — tokens em src/styles/tokens.css). */
export function LogoMicrosoft() {
  return (
    <svg className="ul-ms-logo" viewBox="0 0 21 21" aria-hidden>
      <path fill="var(--color-ms-red)" d="M0 0h10v10H0z" />
      <path fill="var(--color-ms-green)" d="M11 0h10v10H11z" />
      <path fill="var(--color-ms-blue)" d="M0 11h10v10H0z" />
      <path fill="var(--color-ms-yellow)" d="M11 11h10v10H11z" />
    </svg>
  )
}
