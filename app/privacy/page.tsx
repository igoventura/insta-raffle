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
              compartilhamos informações quando você utiliza nosso aplicativo web para realizar sorteios no Instagram.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados que Coletamos</h2>
            <p>Ao utilizar o Insta-Raffle e fazer login através da sua conta do Facebook/Instagram, podemos acessar:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Informações básicas do seu perfil do Instagram (nome, nome de usuário, foto de perfil).</li>
              <li>Lista de publicações da sua conta do Instagram.</li>
              <li>Comentários públicos feitos nas publicações que você selecionar para o sorteio.</li>
            </ul>
            <p className="mt-2">
              <strong>Aviso Importante:</strong> Nós não solicitamos, nem armazenamos a sua senha do Facebook ou Instagram. 
              A autenticação é feita diretamente pelos servidores da Meta de forma segura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Como Usamos seus Dados</h2>
            <p>Utilizamos os dados coletados exclusivamente para fornecer o serviço principal do aplicativo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Exibir suas contas e publicações para que você possa escolher qual post será sorteado.</li>
              <li>Ler os comentários da publicação escolhida para verificar menções (@) e validar os participantes.</li>
              <li>Selecionar aleatoriamente o(s) vencedor(es) do seu sorteio.</li>
            </ul>
            <p className="mt-2">
              Seus dados de sessão (tokens de acesso) são armazenados localmente em cookies seguros (HTTP-only) no seu navegador para manter a sua sessão ativa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Compartilhamento de Dados</h2>
            <p>
              Nós não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros. As únicas trocas de informações 
              ocorrem diretamente entre o nosso aplicativo e as APIs oficiais da Meta (Facebook/Instagram Graph API) e nosso 
              provedor de autenticação (Supabase).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Exclusão de Dados</h2>
            <p>
              Você pode revogar o acesso do Insta-Raffle à sua conta a qualquer momento diretamente nas configurações 
              de &quot;Aplicativos e Sites&quot; do seu Facebook ou Instagram. Como nosso aplicativo não armazena os dados dos 
              seus comentários ou posts em um banco de dados permanente, ao sair (logout) ou revogar o acesso, nós 
              perdemos imediatamente qualquer acesso futuro às suas informações.
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
