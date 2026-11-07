import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Política de Privacidade | Insta-Raffle',
  description: 'Política de Privacidade do aplicativo Insta-Raffle',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="mb-8">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 mb-6">
            <ArrowLeft className="w-4 h-4" /> Voltar para o início
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introdução</h2>
            <p>
              O Insta-Raffle (&quot;nós&quot;, &quot;nosso&quot;) respeita a sua privacidade e está comprometido em proteger as informações 
              pessoais que você compartilha conosco. Esta Política de Privacidade explica como coletamos, usamos e 
              compartilhamos informações quando você utiliza nosso aplicativo web para realizar sorteios auditáveis no Instagram.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados que Coletamos</h2>
            <p>Ao utilizar o Insta-Raffle e fazer login através da API oficial do Instagram com Login do Instagram, podemos acessar:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Informações básicas do seu perfil profissional do Instagram (ID da conta, nome de usuário e foto de perfil).</li>
              <li>Lista de publicações da sua conta do Instagram.</li>
              <li>Comentários públicos de nível superior feitos nas publicações que você selecionar para o sorteio.</li>
            </ol>
            <p className="mt-2">
              <strong>Aviso Importante:</strong> Nós não solicitamos, nem armazenamos a sua senha do Instagram. 
              A autenticação é feita diretamente pelos servidores oficiais do Instagram (Meta) via OAuth 2.0.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Como Usamos seus Dados</h2>
            <p>Utilizamos os dados coletados exclusivamente para fornecer o serviço principal do aplicativo:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Exibir suas publicações para que você possa escolher qual post será sorteado.</li>
              <li>Ler os comentários públicos da publicação escolhida para verificar menções (@) e validar os participantes.</li>
              <li>Selecionar aleatoriamente o(s) vencedor(es) e suplentes do seu sorteio e gerar um certificado público de auditoria imutável.</li>
            </ol>
            <p className="mt-2">
              Seus dados de sessão (tokens de acesso) são armazenados localmente em cookies criptografados (AES-256-GCM, HTTP-only) no seu navegador para manter a sua sessão ativa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Compartilhamento e Armazenamento de Dados</h2>
            <p>
              Nós não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins comerciais. As únicas trocas de informações 
              ocorrem diretamente entre o nosso aplicativo, a API oficial do Instagram (<code>graph.instagram.com</code>) e o nosso 
              banco de dados de certificados de auditoria no Google Firebase (Cloud Firestore), onde são gravados apenas o resumo estatístico do sorteio, 
              as regras aplicadas e os comentários vencedores/suplentes para verificação pública em <code>/verify/[drawId]</code>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Exclusão de Dados</h2>
            <p>
              Você pode revogar o acesso do Insta-Raffle à sua conta a qualquer momento diretamente nas configurações 
              de &quot;Aplicativos e Sites&quot; do seu Instagram. Como nosso aplicativo não armazena a lista bruta de todos os comentários 
              dos seus posts em banco de dados permanente, ao sair (logout) ou revogar o acesso, seu cookie de sessão é removido imediatamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contato</h2>
            <p>
              Se você tiver alguma dúvida sobre esta Política de Privacidade ou sobre como seus dados são tratados, 
              sinta-se à vontade para entrar em contato com o desenvolvedor do aplicativo.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
