import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import imagemEject from '../../assets/projeto/eject-negativo.png'
import formasCta from '../../assets/projeto/formas-cta.svg'
import formasHeroCelular from '../../assets/projeto/formas-hero-celular.svg'
import formasHero from '../../assets/projeto/formas-hero.svg'
import formasSobre from '../../assets/projeto/formas-sobre.svg'
import lampada from '../../assets/projeto/lampada.svg'
import {
  IconeDispositivos,
  IconeGrafico,
  IconeMaisCirculo,
  IconePerguntasEmPilha,
  IconePin,
  IconePlayCirculo,
  IconeSetaLonga,
} from '../../componentes/icones/Icones'
import Logo from '../../componentes/marca/Logo'
import { listarEstudo } from '../../servicos/materiais'
import { useSessao } from '../../sessao/contexto'
import CapaMaterial from '../materiais/CapaMaterial'
import { rotuloTipo } from '../materiais/capas'
import estilos from './PaginaProjeto.module.css'

const VANTAGENS = [
  { valor: 'Ao vivo', texto: 'quiz em sala', cor: 'azul' },
  { valor: '+Conteúdo', texto: 'vídeos e artigos', cor: 'laranja' },
  { valor: '6º ao 9º', texto: 'e Ensino Médio', cor: 'azulClaro' },
  { valor: 'Mossoró', texto: 'escolas públicas', cor: 'laranjaForte' },
]

const PASSOS = [
  { titulo: 'O educador cria', texto: 'Escolhe o tema e abre uma sala com um PIN único.', Icone: IconeMaisCirculo },
  { titulo: 'A turma entra', texto: 'Cada estudante usa o celular, tablet ou computador.', Icone: IconePin },
  {
    titulo: 'O desafio começa',
    texto: 'Todos respondem juntos enquanto a tela mostra a rodada.',
    Icone: IconePerguntasEmPilha,
  },
  { titulo: 'Todo mundo evolui', texto: 'O ranking celebra a turma e revela o que revisar depois.', Icone: IconeGrafico },
]

/** Tracejado que liga um passo ao próximo (mockup: "Vector 39/40/41"). */
function Conector({ invertido }) {
  return (
    <svg
      className={`${estilos.conector} ${invertido ? estilos.invertido : ''}`}
      width="53"
      height="166.5"
      viewBox="0 0 53 166.5"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M53 2H49.625M0 164.5H4.5M13.5 164.5H18C20.2091 164.5 22 162.709 22 160.5V156.637M22 148.913V141.188M22 133.463V125.737M22 118.012V110.288M22 102.563V94.8375M22 87.1125V79.3875M22 71.6625V63.9375M22 56.2125V48.4875M22 40.7625V33.0375M22 25.3125V17.5875M22 9.86251V6C22 3.79086 23.7909 2 26 2H29.375M36.125 2H42.875"
        strokeWidth="4"
        stroke="currentColor"
      />
    </svg>
  )
}

/** Até três materiais públicos (ou da turma, para quem está logado), como no "Continue aprendendo". */
function MateriaisEmDestaque() {
  const { usuario, carregando: carregandoSessao } = useSessao()
  const [versao, setVersao] = useState(0)
  const [carga, setCarga] = useState({ chave: null, materiais: [], erro: false })
  const chave = `${versao}#${usuario?.id ?? ''}`
  const carregando = carga.chave !== chave

  useEffect(() => {
    if (carregandoSessao) return undefined
    let ativo = true
    listarEstudo({ por_pagina: 3 })
      .then((dados) => ativo && setCarga({ chave, materiais: dados.results ?? [], erro: false }))
      .catch(() => ativo && setCarga({ chave, materiais: [], erro: true }))
    return () => {
      ativo = false
    }
  }, [chave, carregandoSessao])

  if (carregando) {
    return (
      <ul className={estilos.materiais} aria-busy="true" aria-label="Carregando materiais">
        {[0, 1, 2].map((indice) => (
          <li key={indice} className={`${estilos.material} ${estilos.esqueleto}`} />
        ))}
      </ul>
    )
  }

  if (carga.erro) {
    return (
      <div className={estilos.avisoMateriais} role="alert">
        <p>Não foi possível carregar os materiais agora.</p>
        <button type="button" className={estilos.tentarDeNovo} onClick={() => setVersao((v) => v + 1)}>
          Tentar de novo
        </button>
      </div>
    )
  }

  if (carga.materiais.length === 0) {
    return (
      <div className={estilos.avisoMateriais}>
        <p>Os primeiros materiais estão chegando. Volte em breve!</p>
      </div>
    )
  }

  return (
    <ul className={estilos.materiais} aria-label="Materiais em destaque">
      {carga.materiais.map((material) => (
        <li key={material.id}>
          <Link to={`/materiais/${material.id}`} className={estilos.material}>
            <CapaMaterial material={material} />
            <div className={estilos.corpoMaterial}>
              <p className={estilos.linhaMaterial}>
                <span className={estilos.tipoMaterial}>{rotuloTipo(material)}</span>
                {material.disciplina && <span>{material.disciplina}</span>}
              </p>
              <h3 className={estilos.tituloMaterial}>{material.titulo}</h3>
              {material.descricao && <p className={estilos.descricaoMaterial}>{material.descricao}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * "O projeto" (mockup "LP - Desktop/Mobile", 29:4): a página inicial do Sabiá.
 * A lâmpada sobe e acende (frames 1→3 do mockup) e o conteúdo aparece em seguida.
 */
export default function PaginaProjeto() {
  const id = useId()

  return (
    <div className={estilos.pagina}>
      <section className={estilos.abertura} aria-labelledby={`${id}-titulo`}>
        <img src={lampada} alt="" className={estilos.lampada} />
        <img src={formasHero} alt="" className={`${estilos.formasAbertura} ${estilos.soDesktop}`} />
        <img src={formasHeroCelular} alt="" className={`${estilos.formasAbertura} ${estilos.soCelular}`} />
        <div className={estilos.conteudoAbertura}>
          <h1 id={`${id}-titulo`} className={estilos.tituloAbertura}>
            Aprender pode ser <span className={estilos.tituloEscuro}>a melhor jogada</span>
          </h1>
          <p className={estilos.textoAbertura}>
            A energia do futuro é agora. Jogue, aprenda e transforme com desafios ao vivo, vídeos e materiais sobre
            energia solar, reciclagem e sustentabilidade.
          </p>
          <div className={estilos.botoesAbertura}>
            <Link to="/entrar-pin" className={`${estilos.botao} ${estilos.botaoAzul}`}>
              <IconePin />
              Entrar com PIN
            </Link>
            <Link to="/materiais" className={`${estilos.botao} ${estilos.botaoClaro}`}>
              <IconePlayCirculo />
              Explorar materiais
            </Link>
          </div>
          <p className={estilos.info}>
            <IconeDispositivos />
            Sem instalar nada. É só abrir, inserir o PIN e jogar.
          </p>
        </div>
      </section>

      <ul className={estilos.vantagens} aria-label="O Sabiá em números">
        {VANTAGENS.map((vantagem) => (
          <li key={vantagem.valor} className={estilos.vantagem}>
            <strong className={`${estilos.valorVantagem} ${estilos[vantagem.cor]}`}>{vantagem.valor}</strong>
            <span className={estilos.textoVantagem}>{vantagem.texto}</span>
          </li>
        ))}
      </ul>

      <section className={estilos.sobre} aria-labelledby={`${id}-sobre`}>
        <img src={formasSobre} alt="" className={estilos.formasSobre} />
        <div className={estilos.conteudoSobre}>
          <h2 id={`${id}-sobre`} className={estilos.tituloSobre}>
            <span className={estilos.azulClaro}>Uma turma inteira</span>{' '}
            <span className={estilos.laranja}>ligada na mesma energia</span>
          </h2>
          <p className={estilos.textoSobre}>
            Perguntas em tempo real, pontos por acerto e velocidade, e um ranking que deixa cada rodada mais
            emocionante.
          </p>
          <ol className={estilos.passos}>
            {PASSOS.map(({ titulo, texto, Icone }, indice) => (
              <li key={titulo} className={`${estilos.passo} ${estilos[`passo${indice + 1}`]}`}>
                <div className={estilos.cartaoPasso}>
                  <div className={estilos.topoPasso}>
                    <span className={estilos.iconePasso} aria-hidden="true">
                      <Icone />
                    </span>
                    <span className={estilos.numeroPasso} aria-hidden="true">
                      {String(indice + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className={estilos.tituloPasso}>
                    <span className="visualmente-oculto">Passo {indice + 1}: </span>
                    {titulo}
                  </h3>
                  <p className={estilos.textoPasso}>{texto}</p>
                </div>
                {indice < PASSOS.length - 1 && <Conector invertido={indice !== 1} />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={estilos.estudos} aria-labelledby={`${id}-estudos`}>
        <div className={estilos.cabecaEstudos}>
          <h2 id={`${id}-estudos`} className={estilos.tituloEstudos}>
            O jogo acaba. <span className={estilos.laranjaForte}>A descoberta continua.</span>
          </h2>
          <p className={estilos.textoEstudos}>
            O Sabiá vai além do quiz: encontre vídeos curtos, artigos e PDF’s para rever cada assunto no seu ritmo e
            aprofundar o que você descobriu em sala.
          </p>
        </div>
        <span className={estilos.passaroEstudos}>
          <Logo largura={100} semTexto />
        </span>
        <MateriaisEmDestaque />
        <Link to="/materiais" className={`${estilos.botao} ${estilos.botaoEscuro}`}>
          Ver todos os materiais
          <IconeSetaLonga />
        </Link>
      </section>

      <section className={estilos.chamada} aria-labelledby={`${id}-chamada`}>
        <img src={formasCta} alt="" className={estilos.formasChamada} />
        <div className={estilos.conteudoChamada}>
          <Logo largura={75} semTexto />
          <h2 id={`${id}-chamada`} className={estilos.tituloChamada}>
            Pronto para aprender <span className={estilos.laranja}>em outra frequência?</span>
          </h2>
          <p className={estilos.textoChamada}>
            Entre na partida da sua turma ou explore os materiais para continuar aprendendo.
          </p>
          <div className={estilos.botoesChamada}>
            <Link to="/entrar-pin" className={`${estilos.botao} ${estilos.botaoLaranja}`}>
              <IconePin />
              Entrar com PIN
            </Link>
            <Link to="/materiais" className={`${estilos.botao} ${estilos.botaoClaro}`}>
              <IconePlayCirculo />
              Ver materiais
            </Link>
          </div>
        </div>
      </section>

      <footer className={estilos.rodape}>
        <div className={estilos.colunasRodape}>
          <div className={estilos.marcaRodape}>
            <Logo largura={112} corTexto="branco" tamanhoNome={37} />
            <p>A energia do futuro é agora. Jogue, aprenda e transforme.</p>
          </div>
          <nav className={estilos.colunaRodape} aria-labelledby={`${id}-info`}>
            <h2 id={`${id}-info`}>Informações</h2>
            <ul>
              <li>
                <Link to="/criar-conta">Criar conta</Link>
              </li>
              <li>
                <Link to="/materiais">Materiais</Link>
              </li>
              <li>
                <Link to="/entrar-pin">Jogar</Link>
              </li>
              <li>
                <Link to="/como-funciona">Como funciona</Link>
              </li>
            </ul>
          </nav>
          <div className={estilos.colunaRodape}>
            <h2>Contatos</h2>
            <ul>
              <li>
                <a href="mailto:sinergy@ufrn.com.br">sinergy@ufrn.com.br</a>
              </li>
            </ul>
          </div>
        </div>
        <div className={estilos.baseRodape}>
          <img src={imagemEject} alt="Desenvolvido pela EJECT" width="110" height="41" />
        </div>
      </footer>
    </div>
  )
}
