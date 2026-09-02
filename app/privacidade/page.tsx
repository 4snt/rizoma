import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Rizoma',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>
        🧬 Rizoma — Política de Privacidade
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Última atualização: setembro de 2026</p>

      <Section title="1. O que é o Rizoma">
        <p>
          O Rizoma é a plataforma de gestão laboratorial (LIMS) e análise de micobioma e
          transcriptômica desenvolvida no Departamento de Computação (DECOM) da UFVJM, em
          conjunto com os projetos NEBIM e INOVAHERB. É de uso restrito a pesquisadores,
          técnicos e colaboradores autorizados da instituição — não é um serviço público de
          cadastro aberto.
        </p>
      </Section>

      <Section title="2. Quais dados coletamos">
        <p>O acesso é feito exclusivamente via login com Google, restrito a contas do domínio institucional. Do provedor Google recebemos e armazenamos:</p>
        <ul style={{ margin: '8px 0 0 18px' }}>
          <li>Nome e e-mail institucional</li>
          <li>Foto de perfil (avatar), se disponível na conta Google</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          Não coletamos nem armazenamos senhas — a autenticação é inteiramente delegada ao
          Google (OAuth 2.0).
        </p>
        <p style={{ marginTop: 8 }}>
          Além disso, no uso normal da plataforma, ficam registrados: papel/função do usuário
          na organização, data do último login, quem convidou cada membro, e os dados de
          trabalho que você mesmo insere — projetos, amostras, arquivos de sequenciamento
          (ex.: FASTQ), resultados de análises bioinformáticas e laudos técnicos gerados.
        </p>
      </Section>

      <Section title="3. Convites de acesso">
        <p>
          O ingresso de novos usuários depende de convite enviado por um administrador da
          organização a um e-mail institucional específico. Ao aceitar um convite (fazendo
          login com essa conta Google), o vínculo é criado automaticamente.
        </p>
      </Section>

      <Section title="4. Para que usamos esses dados">
        <ul style={{ margin: '0 0 0 18px' }}>
          <li>Autenticar o usuário e controlar o acesso por organização e papel</li>
          <li>Rastrear amostras, análises e resultados de forma auditável</li>
          <li>Emitir laudos técnicos e permitir sua verificação pública por QR Code (o laudo verificado não expõe dados pessoais além dos já impressos no próprio documento)</li>
          <li>Comunicar convites e avisos operacionais por e-mail</li>
        </ul>
        <p style={{ marginTop: 8 }}>Não usamos os dados para publicidade e não fazemos rastreamento de terceiros.</p>
      </Section>

      <Section title="5. Onde os dados ficam armazenados">
        <p>
          A infraestrutura (banco de dados, armazenamento de arquivos e processamento das
          análises) roda em servidores sob gestão direta da equipe do projeto. Utilizamos o
          Google apenas para autenticação e um provedor de envio de e-mail transacional
          (convites e notificações) — nenhum dado de pesquisa é compartilhado com esses
          terceiros além do estritamente necessário para essas funções.
        </p>
      </Section>

      <Section title="6. Sessão e cookies">
        <p>
          Usamos um único cookie de sessão, necessário para manter você autenticado. Ele não é
          usado para publicidade ou rastreamento entre sites.
        </p>
      </Section>

      <Section title="7. Retenção e exclusão">
        <p>
          Os dados são mantidos enquanto sua conta ou organização estiver ativa. Você pode
          solicitar a correção ou exclusão dos seus dados pessoais a qualquer momento pelo
          contato abaixo, nos termos da Lei Geral de Proteção de Dados (LGPD).
        </p>
      </Section>

      <Section title="8. Contato">
        <p>
          Dúvidas sobre esta política ou sobre seus dados: entre em contato com o
          administrador do Rizoma na sua organização, ou pelo e-mail{' '}
          <a href="mailto:murilo.escobedo@hotmail.com" style={{ color: 'var(--cyan)' }}>
            murilo.escobedo@hotmail.com
          </a>.
        </p>
      </Section>
    </div>
  )
}
