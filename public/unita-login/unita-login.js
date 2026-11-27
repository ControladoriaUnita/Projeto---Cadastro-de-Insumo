/**
 * Tela de login Unità — versão JavaScript puro (sem framework).
 * Para ferramentas que montam as telas por JS (ex.: Relatório de Aporte, Apresentação Planejamento).
 *
 * Uso:
 *   import { montarTelaLogin, botaoMicrosoft } from '/unita-login/unita-login.js'
 *   const conteudo = montarTelaLogin(document.getElementById('raiz'), {
 *     area: 'Controladoria',
 *     ferramenta: 'Relatório de Aporte',
 *     descricao: 'Custos, despesas, projeção e aportes de cada obra, num só lugar.',
 *   })
 *   conteudo.innerHTML = botaoMicrosoft()   // ou o formulário que a ferramenta já tem
 *
 * Só desenha a tela: o login de verdade continua o da ferramenta (ver "Kit - Login Microsoft").
 * Precisa de unita-login.css carregado na página.
 */

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Desenha a tela dentro de `raiz` (substitui o que havia nela) e devolve o elemento
 * onde a ferramenta coloca os botões / formulário de entrar.
 *
 * @param {HTMLElement} raiz
 * @param {object} o
 * @param {string} o.area            linha pequena acima do nome da ferramenta (ex.: "Suprimentos")
 * @param {string} o.ferramenta      nome da ferramenta (ex.: "Cadastro de fornecedores")
 * @param {string} [o.descricao]     frase curta do painel da marca
 * @param {string} [o.titulo]        título do cartão (padrão "Bem-vindo")
 * @param {string} [o.subtitulo]     texto abaixo do título
 * @param {string} [o.erro]          mensagem de erro (se não vier, usa ?erro= do endereço)
 * @param {string} [o.rodape]        padrão "Unità Engenharia · uso interno"
 * @param {string} [o.pastaMarca]    onde estão as imagens (padrão "/unita-login")
 * @returns {HTMLElement}
 */
export function montarTelaLogin(raiz, o) {
  const pasta = o.pastaMarca ?? '/unita-login'
  const erro = o.erro ?? new URLSearchParams(location.search).get('erro')
  raiz.innerHTML = `
    <div class="ul-login">
      <aside class="ul-marca">
        <img class="ul-padrao" src="${esc(pasta)}/pattern-un.png" alt="" aria-hidden="true" />
        <img class="ul-logo" src="${esc(pasta)}/logo-unita-white.png" alt="Unità Engenharia" />
        <div class="ul-marca-texto">
          <p class="ul-sobretitulo">${esc(o.area)}</p>
          <h2>${esc(o.ferramenta)}</h2>
          ${o.descricao ? `<p>${esc(o.descricao)}</p>` : ''}
        </div>
      </aside>
      <section class="ul-acesso">
        <div class="ul-cartao">
          <p class="ul-sobretitulo">Unità · ${esc(o.area)}</p>
          <h1>${esc(o.titulo ?? 'Bem-vindo')}</h1>
          <p class="ul-subtitulo">${esc(o.subtitulo ?? 'Entre com a sua conta corporativa para acessar a ferramenta.')}</p>
          ${erro ? `<div class="ul-aviso" role="alert">${esc(erro)}</div>` : ''}
          <div class="ul-conteudo" data-ul-conteudo></div>
        </div>
        <p class="ul-rodape">${esc(o.rodape ?? 'Unità Engenharia · uso interno')}</p>
      </section>
    </div>`
  return raiz.querySelector('[data-ul-conteudo]')
}

/** Logo oficial da Microsoft (4 quadrados). */
export const LOGO_MICROSOFT = `<svg class="ul-ms-logo" viewBox="0 0 21 21" aria-hidden="true">
  <path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#7fba00" d="M11 0h10v10H11z"/>
  <path fill="#00a4ef" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg>`

/**
 * HTML do botão "Entrar com Microsoft 365" + a nota abaixo.
 * @param {object} [o]
 * @param {string} [o.href]   rota que inicia o login (padrão "/api/auth/microsoft/start")
 * @param {string} [o.nota]   texto pequeno abaixo do botão
 */
export function botaoMicrosoft(o = {}) {
  const href = o.href ?? '/api/auth/microsoft/start'
  const nota = o.nota ?? 'Use sua conta corporativa da Unità.'
  return `<a class="ul-botao" href="${esc(href)}" data-ul-microsoft>${LOGO_MICROSOFT}Entrar com Microsoft 365</a>
    ${nota ? `<p class="ul-nota">${esc(nota)}</p>` : ''}`
}

/** Troca o texto do botão por "carregando" (ex.: "Abrindo a Microsoft…") e o desativa. */
export function aguardar(botao, texto) {
  botao.setAttribute('aria-disabled', 'true')
  if ('disabled' in botao) botao.disabled = true
  botao.innerHTML = `<span class="ul-girando"></span>${esc(texto)}`
}

// Com o botão da Microsoft, mostra "Abrindo a Microsoft…" ao clicar.
document.addEventListener('click', (e) => {
  const botao = e.target instanceof Element && e.target.closest('[data-ul-microsoft]')
  if (botao) aguardar(botao, 'Abrindo a Microsoft…')
})
