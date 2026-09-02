import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Serviço — Rizoma',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

export default function TermsOfServicePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>
        🧬 Rizoma — Termos de Serviço
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Última atualização: setembro de 2026</p>

      <Section title="1. Aceite">
        <p>
          O Rizoma é uma ferramenta acadêmica de gestão laboratorial (LIMS) e análise de
          micobioma e transcriptômica, desenvolvida no Departamento de Computação (DECOM) da
          UFVJM em conjunto com os projetos NEBIM e INOVAHERB. Ao acessar ou usar a
          plataforma, você concorda com estes Termos e com a{' '}
          <Link href="/privacidade" style={{ color: 'var(--cyan)' }}>Política de Privacidade</Link>.
        </p>
      </Section>

      <Section title="2. Elegibilidade e acesso">
        <p>
          O acesso é restrito a pessoas com conta Google do domínio institucional e que
          tenham recebido um convite de um administrador da plataforma. Não há
          autocadastro. O acesso pode ser revogado a qualquer momento por um administrador,
          sem aviso prévio, especialmente em caso de uso indevido ou desligamento do vínculo
          institucional.
        </p>
      </Section>

      <Section title="3. Uso aceitável">
        <p>Ao usar o Rizoma, você concorda em:</p>
        <ul style={{ margin: '8px 0 0 18px' }}>
          <li>Usar a plataforma apenas para fins de pesquisa, ensino ou atividades laboratoriais legítimas da instituição;</li>
          <li>Não tentar acessar dados, amostras ou resultados de outra organização/projeto sem autorização;</li>
          <li>Não tentar contornar os controles de acesso, autenticação ou as políticas de isolamento entre organizações;</li>
          <li>Não sobrecarregar deliberadamente o sistema (ex.: submissão massiva de jobs de bioinformática sem propósito real);</li>
          <li>Respeitar a autoria e a propriedade intelectual dos dados inseridos por outros pesquisadores.</li>
        </ul>
      </Section>

      <Section title="4. Seus dados e resultados">
        <p>
          Amostras, projetos, arquivos de sequenciamento, resultados de análises e laudos que
          você cadastra continuam pertencendo a você e/ou à sua instituição de origem — o
          Rizoma é apenas a ferramenta que processa e armazena esse conteúdo em nome da sua
          organização. Laudos técnicos emitidos pela plataforma podem ser verificados
          publicamente por QR Code; você é responsável pela exatidão dos dados que insere.
        </p>
      </Section>

      <Section title="5. Licença do software">
        <p>
          O código-fonte do Rizoma (frontend e backend) é distribuído sob a licença{' '}
          <strong>GNU General Public License v3.0 (GPLv3)</strong> — software livre, sem
          garantia, com o texto completo incluído em cada repositório. Isso rege o
          código em si; estes Termos regem o uso desta instância hospedada específica.
        </p>
        <ul style={{ margin: '8px 0 0 18px' }}>
          <li><a href="https://github.com/4snt/rizoma" style={{ color: 'var(--cyan)' }} target="_blank" rel="noopener noreferrer">github.com/4snt/rizoma</a> (frontend)</li>
          <li><a href="https://github.com/4snt/rizoma-backend" style={{ color: 'var(--cyan)' }} target="_blank" rel="noopener noreferrer">github.com/4snt/rizoma-backend</a> (backend)</li>
        </ul>
      </Section>

      <Section title="6. Disponibilidade do serviço">
        <p>
          Esta instância do Rizoma é um projeto acadêmico (TCC) rodando em infraestrutura
          própria da equipe. Não há garantia formal de disponibilidade (SLA): o serviço pode
          ficar temporariamente indisponível para manutenção, atualizações ou por motivos
          técnicos fora do nosso controle.
        </p>
      </Section>

      <Section title="7. Isenção de garantias e limitação de responsabilidade">
        <p>
          A plataforma é fornecida &quot;como está&quot;, sem garantias de qualquer tipo, na
          máxima extensão permitida pela lei. A equipe do Rizoma não se responsabiliza por
          perdas decorrentes de indisponibilidade do serviço, uso indevido de credenciais de
          acesso, ou decisões tomadas exclusivamente com base em resultados gerados pela
          plataforma — laudos e análises devem ser conferidos por um responsável técnico
          qualificado antes de qualquer uso oficial.
        </p>
      </Section>

      <Section title="8. Encerramento de acesso">
        <p>
          Um administrador pode revogar seu convite ou desativar sua conta a qualquer
          momento. Você pode solicitar o encerramento da sua conta e a exclusão dos seus
          dados pessoais a qualquer momento, conforme descrito na{' '}
          <Link href="/privacidade" style={{ color: 'var(--cyan)' }}>Política de Privacidade</Link>.
        </p>
      </Section>

      <Section title="9. Alterações nestes termos">
        <p>
          Podemos atualizar estes Termos conforme a plataforma evolui. A data no topo desta
          página indica a última atualização.
        </p>
      </Section>

      <Section title="10. Lei aplicável">
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
      </Section>

      <Section title="11. Contato">
        <p>
          Dúvidas sobre estes Termos: entre em contato com o administrador do Rizoma na sua
          organização, ou pelo e-mail{' '}
          <a href="mailto:murilo.escobedo@hotmail.com" style={{ color: 'var(--cyan)' }}>
            murilo.escobedo@hotmail.com
          </a>.
        </p>
      </Section>
    </div>
  )
}
