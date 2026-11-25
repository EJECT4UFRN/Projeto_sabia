import { useId } from 'react'
import Botao from '../../componentes/botoes/Botao'
import { IconeCapelo, IconeControle, IconeLivro, IconePin, IconeRaio, IconeSetaDireita } from '../../componentes/icones/Icones'
import { VISUAL_ALTERNATIVAS } from '../partida/visual'
import estilos from './PaginaComoFunciona.module.css'

const PASSOS_ALUNO = [
  {
    titulo: 'Digite o PIN',
    texto: 'O professor mostra no telão um código de 6 números. Digite em “Entrar com PIN”, no celular ou no computador.',
  },
  {
    titulo: 'Escolha seu apelido',
    texto: 'Entre com a sua conta ou só com um apelido, como convidado. Com a conta, a partida fica no seu histórico.',
  },
  {
    titulo: 'Responda rápido',
    texto: 'Cada pergunta aparece no telão e as alternativas no seu aparelho. Toque na que achar certa antes do tempo acabar.',
  },
  {
    titulo: 'Suba no pódio',
    texto: 'Depois de cada pergunta sai o ranking. No fim, os três primeiros sobem ao pódio.',
  },
]

const PASSOS_PROFESSOR = [
  { titulo: 'Monte o banco de perguntas', texto: 'Perguntas de 4 alternativas, com tempo, pontuação, categoria e imagem.' },
  { titulo: 'Crie o quiz', texto: 'Escolha as perguntas, a ordem e se quer embaralhar. Publique para poder jogar.' },
  { titulo: 'Abra a sala', texto: 'O Sabiá gera o PIN e o QR Code. Você controla o ritmo pelo telão e pode tirar alguém da sala.' },
  { titulo: 'Veja o resultado', texto: 'O relatório mostra o pódio, o ranking completo e quanto a turma acertou em cada pergunta.' },
]

const PERGUNTAS = [
  {
    pergunta: 'Preciso criar uma conta para jogar?',
    resposta:
      'Não. Dá para entrar só com um apelido, como convidado. A conta serve para guardar suas partidas no histórico e para ver os materiais da sua turma.',
  },
  {
    pergunta: 'Posso entrar com o jogo já começado?',
    resposta:
      'Pode. Você joga a partir da pergunta em que entrou; as perguntas que já passaram não contam pontos para você.',
  },
  {
    pergunta: 'Minha internet caiu. Perdi os pontos?',
    resposta:
      'Não. Volte para a partida no mesmo aparelho (ou pelo histórico, se estiver logado) e seus pontos continuam lá.',
  },
  {
    pergunta: 'Posso trocar de resposta?',
    resposta: 'Não. Vale a primeira resposta que você tocar, então pense rápido, mas com calma.',
  },
  {
    pergunta: 'Onde ficam os materiais de estudo?',
    resposta:
      'Em “Materiais”. Os públicos qualquer pessoa vê. Os da sua turma aparecem quando você entra nela com o código que o professor passa, em Perfil → Minhas turmas.',
  },
  {
    pergunta: 'Sou professor. Como começo?',
    resposta:
      'Crie sua conta de professor, monte algumas perguntas no banco, junte-as num quiz e publique. Depois é só abrir a sala e mostrar o PIN para a turma.',
  },
]

/** "Como funciona" (sem mockup): o passo a passo para alunos e professores, a pontuação e dúvidas comuns. */
export default function PaginaComoFunciona() {
  const id = useId()

  return (
    <div className={estilos.pagina}>
      <header className={estilos.topo}>
        <p className={estilos.sobretitulo}>Como funciona</p>
        <h1 className={estilos.titulo}>
          Aprender jogando, <span className={estilos.destaque}>todo mundo junto.</span>
        </h1>
        <p className={estilos.descricao}>
          O Sabiá é um quiz ao vivo: o professor projeta as perguntas no telão e a turma responde pelo celular.
          Quem acerta mais rápido ganha mais pontos.
        </p>
        <div className={estilos.botoes}>
          <Botao para="/entrar-pin" icone={<IconePin />}>
            Entrar com PIN
          </Botao>
          <Botao para="/criar-conta" variante="secundario">
            Criar conta
          </Botao>
        </div>
      </header>

      <section className={estilos.secao} aria-labelledby={`${id}-aluno`}>
        <div className={estilos.cabecaSecao}>
          <span className={`${estilos.iconeSecao} ${estilos.laranja}`}>
            <IconeControle />
          </span>
          <div>
            <p className={estilos.rotuloSecao}>Para quem joga</p>
            <h2 id={`${id}-aluno`} className={estilos.tituloSecao}>
              Em 4 passos você está no jogo
            </h2>
          </div>
        </div>
        <ol className={estilos.passos}>
          {PASSOS_ALUNO.map((passo, indice) => {
            const visual = VISUAL_ALTERNATIVAS[indice]
            return (
              <li key={passo.titulo} className={estilos.passo}>
                <span className={`${estilos.marca} ${estilos[visual.classe]}`} aria-hidden="true">
                  <visual.Icone />
                </span>
                <h3 className={estilos.tituloPasso}>
                  <span className="visualmente-oculto">Passo {indice + 1}: </span>
                  {passo.titulo}
                </h3>
                <p className={estilos.textoPasso}>{passo.texto}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className={`${estilos.secao} ${estilos.pontuacao}`} aria-labelledby={`${id}-pontos`}>
        <div className={estilos.cabecaSecao}>
          <span className={`${estilos.iconeSecao} ${estilos.amarelo}`}>
            <IconeRaio />
          </span>
          <div>
            <p className={estilos.rotuloSecao}>Pontuação</p>
            <h2 id={`${id}-pontos`} className={estilos.tituloSecao}>
              Acertar conta. Acertar rápido conta mais.
            </h2>
          </div>
        </div>
        <dl className={estilos.regras}>
          <div className={estilos.regra}>
            <dt>Acertou</dt>
            <dd>
              Ganha de <strong>50% a 100%</strong> dos pontos da pergunta (normalmente 1.000). Quanto mais rápido, mais
              perto dos 100%.
            </dd>
          </div>
          <div className={estilos.regra}>
            <dt>Acertou em sequência</dt>
            <dd>
              O bônus cresce a cada acerto seguido: <strong>+100</strong> no 2º, <strong>+200</strong> no 3º… até{' '}
              <strong>+500</strong> por pergunta.
            </dd>
          </div>
          <div className={estilos.regra}>
            <dt>Errou ou não respondeu</dt>
            <dd>
              Vale <strong>0</strong> e a sequência recomeça. O tempo acaba sozinho, ou antes, se todo mundo já respondeu.
            </dd>
          </div>
        </dl>
      </section>

      <section className={estilos.secao} aria-labelledby={`${id}-professor`}>
        <div className={estilos.cabecaSecao}>
          <span className={`${estilos.iconeSecao} ${estilos.azul}`}>
            <IconeCapelo />
          </span>
          <div>
            <p className={estilos.rotuloSecao}>Para quem ensina</p>
            <h2 id={`${id}-professor`} className={estilos.tituloSecao}>
              Do banco de perguntas ao pódio
            </h2>
          </div>
        </div>
        <ol className={`${estilos.passos} ${estilos.passosProfessor}`}>
          {PASSOS_PROFESSOR.map((passo, indice) => (
            <li key={passo.titulo} className={estilos.passo}>
              <span className={estilos.numero} aria-hidden="true">
                {indice + 1}
              </span>
              <h3 className={estilos.tituloPasso}>
                <span className="visualmente-oculto">Passo {indice + 1}: </span>
                {passo.titulo}
              </h3>
              <p className={estilos.textoPasso}>{passo.texto}</p>
            </li>
          ))}
        </ol>
        <p className={estilos.extra}>
          <IconeLivro aria-hidden="true" />
          <span>
            Também dá para publicar vídeos, PDFs e artigos em <strong>Materiais</strong>, para todos ou só para as suas
            turmas.
          </span>
        </p>
        <Botao para="/professor/criar-conta" variante="secundario" className={estilos.botaoProfessor}>
          Criar conta de professor
        </Botao>
      </section>

      <section className={estilos.secao} aria-labelledby={`${id}-duvidas`}>
        <h2 id={`${id}-duvidas`} className={estilos.tituloSecao}>
          Dúvidas frequentes
        </h2>
        <div className={estilos.duvidas}>
          {PERGUNTAS.map(({ pergunta, resposta }) => (
            <details key={pergunta} className={estilos.duvida}>
              <summary>
                {pergunta}
                <IconeSetaDireita className={estilos.seta} aria-hidden="true" />
              </summary>
              <p>{resposta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
