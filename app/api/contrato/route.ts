import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AUTENTIQUE_TOKEN = process.env.AUTENTIQUE_TOKEN!;
const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

interface ContratoPayload {
  nome: string;
  email: string;
  cnpj: string;
  cpf: string;
  rg: string;
  endereco_empresa: string;
  endereco_pessoal: string;
  modalidade: "mensal" | "trimestral" | "quinzenal";
  valor: string;
  data_vencimento: string;
}

function gerarClausulaSexta(modalidade: string, valor: string, dataVencimento: string): string {
  const valorFormatado = valor;
  if (modalidade === "trimestral") {
    return `CLÁUSULA SEXTA - DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO

6.1 Pelos serviços contratados, a CONTRATANTE remunerará a CONTRATADA com o valor de R$${valorFormatado} referente à Taxa de Prestação de Serviços pelos 3 meses, onde esta deverá ser paga através de Boleto Bancário ou pix ou cartão de crédito (sujeito a taxa).`;
  }
  if (modalidade === "quinzenal") {
    return `CLÁUSULA SEXTA - DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO

6.1 Pelos serviços contratados, a CONTRATANTE remunerará a CONTRATADA com o valor de R$${valorFormatado} referente à Taxa de Prestação de Serviços mensal, onde esta deverá ser paga através de Boleto Bancário ou pix ou cartão de crédito (sujeito a taxa). Em 2x quinzenalmente.`;
  }
  return `CLÁUSULA SEXTA - DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO

6.1 Pelos serviços contratados, a CONTRATANTE remunerará a CONTRATADA com o valor de R$${valorFormatado} referente à Taxa de Prestação de Serviços mensal, onde esta deverá ser paga através de Boleto Bancário ou pix ou cartão de crédito (sujeito a taxa).`;
}

function gerarTextoContrato(d: ContratoPayload): string {
  const hoje = new Date();
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const clausulaSexta = gerarClausulaSexta(d.modalidade, d.valor, d.data_vencimento);

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL

Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:

SALX COMPANY inscrita no CNPJ n°.43.797.856/0001-42, com sede na Rua Joaquim Nabuco, 1155 apto 1202 Novo Hamburgo - RS, neste ato representada na forma de seu Contrato Social, por seu representante legal Gustavo Guilherme Silva dos Santos, portador do Documento de Identidade RG nº 5119527769, inscrito no CPF sob o nº. 05336369063, residente e domiciliado em Rua Joaquim Nabuco, 1155 apto 1202 Novo Hamburgo - RS, doravante denominado CONTRATADA e;

${d.nome}, inscrita no CNPJ n°.${d.cnpj} com sede na ${d.endereco_empresa} neste ato representada na forma de seu Contrato Social, por seu representante legal, portador do Documento de Identidade RG ${d.rg} inscrito no CPF sob o n ${d.cpf}., residente e domiciliado em ${d.endereco_pessoal || d.endereco_empresa} doravante denominado CONTRATANTE.

Decidem as partes, na melhor forma de direito, celebrar o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL, que reger-se-á mediante as cláusulas e condições adiante estipuladas.

CLÁUSULA PRIMEIRA - DO OBJETO

1.1 O presente contrato tem por objeto a prestação de serviços profissionais especializados em gestão de marketing digital e geração de potenciais clientes através de anúncios patrocinados em mídias sociais por parte da CONTRATADA de acordo com os termos e condições detalhados neste contrato.

CLÁUSULA SEGUNDA - DAS ETAPAS DO PROJETO E DOCUMENTOS A SEREM ENTREGUES

2.1 A CONTRATANTE deverá encaminhar à CONTRATADA, via whatsapp, o número de identificação da sua Conta de Anúncios, o link da sua Página do "Facebook", bem como as imagens e vídeos necessários para os anúncios. Após confirmar o recebimento do e-mail, a CONTRATADA deverá, no prazo de 48 (quarenta e oito) horas úteis, proceder com a solicitação de novos dados e documentos, caso seja necessário;

2.1.1 A CONTRATANTE é única e exclusivamente responsável por todo material fornecido à CONTRATADA, sendo a única legitimada a figurar no polo passivo de eventuais ações interpostas por terceiros;

2.1.2 A CONTRATANTE deverá fornecer as informações e materiais necessários à realização do serviço no período de tempo máximo de 48 (quarenta e oito) horas úteis após a solicitação;

2.2 Visando regular a prestação de serviços objeto do presente instrumento, caso a CONTRATANTE já possua um Site, deverá providenciar a instalação do "Pixel do Facebook" no mesmo;

2.3 Após configurada a plataforma de anúncios, recebidos os documentos solicitados e preenchido o "Formulário de Novo Cliente" pela CONTRATANTE, serão enviados via whatsapp os Boletos referentes ao pagamento da Taxa de Serviço e da Plataforma de Anúncios, com os valores estabelecidos nos itens 6.1 e 6.2 da Cláusula Sexta;

2.4 Após efetuado o pagamento e o recebimento de toda documentação, informações e materiais necessários para a prestação do serviço, a CONTRATADA terá o período de tempo de 2 (dois) dias úteis para a criação dos criativos, configuração de todas as ferramentas do Funil de Vendas e criação dos anúncios;

2.5 Caso a Conta de Anúncios do "Facebook Business" da CONTRATANTE seja uma conta nova, serão necessários inicialmente 03 (três) dias para aquecimento da conta. Este procedimento é essencial para evitar bloqueios;

2.6 A CONTRATADA se obriga a fornecer à CONTRATANTE um relatório mensal sobre o andamento e execução das campanhas publicitárias.

CLÁUSULA TERCEIRA - OBRIGAÇÕES DA CONTRATANTE

3.1 A CONTRATANTE deverá fornecer à CONTRATADA todas as informações necessárias à realização do serviço, incluindo os dados da empresa, arquivos, acesso a áreas restritas, logotipos e os itens da Cláusula 2.1, os quais devem ser encaminhados via whatsapp dentro de um período de tempo máximo de 48 (quarenta e oito) horas úteis para evitar atrasos ou interrupções dos prazos estabelecidos no cronograma, devendo especificar os detalhes necessários à perfeita consecução do mesmo;

3.2 A CONTRATANTE é obrigada ainda a disponibilizar à CONTRATADA, todo o material necessário para a elaboração dos anúncios patrocinados, incluindo imagens, vídeos, expectativas e metas de campanhas, com antecedência de 48 (quarenta e oito) horas úteis;

3.2.1 A CONTRATADA se reserva no direito de alterar os criativos dos anúncios, incluindo textos, imagens e vídeos, caso seja necessário, para o cumprimento das diretrizes estabelecidas pelas Plataformas de Anúncios;

3.2.2 A CONTRATADA se reserva no direito de alterar os criativos dos anúncios, incluindo textos, imagens e vídeos, caso estejam contrários à Lei, criando apenas anúncios dentro das normas previstas no Código Brasileiro de Autorregulamentação Publicitária (CONAR) e no Código de Defesa do Consumidor;

3.2.3 A CONTRATADA se reserva no direito de efetuar pequenas alterações nos materiais, inclusive os textos, para aperfeiçoar os conteúdos continuamente;

3.2.4 Após as alterações dos criativos serem confirmadas por ambas as partes, não poderão ser solicitadas novas alterações após os Anúncios serem ativados, pois prejudicaria drasticamente a otimização e resultados dos mesmos.

3.3 A CONTRATANTE é única e exclusivamente responsável pelo pagamento dos anúncios à Plataforma do "Facebook Business" ou às demais plataformas de publicidade online, os quais serão publicados e geridos pela CONTRATADA;

3.4 A CONTRATANTE é livre para sugerir todo e qualquer conteúdo informativo para a criação das páginas de captura de seus produtos ou serviços, sendo ela integralmente responsável pelos atos provenientes destas informações, respondendo civil e criminalmente por atos contrários à lei, propaganda enganosa, atos obscenos e violação de direitos autorais;

3.5 A CONTRATANTE tem total liberdade para solicitar alterações nos materiais dos anúncios, incluindo os textos, imagens e vídeos. Após solicitadas, as alterações serão analisadas e publicadas se estiverem de acordo com as diretrizes da plataforma de anúncios;

3.6 A CONTRATANTE deverá responder ao "Formulário de Novo Cliente" enviado pela CONTRATADA, preenchendo todas as informações solicitadas e anexando os documentos necessários à realização do serviço, dentro de um período de tempo máximo de 48 (quarenta e oito) horas úteis após a assinatura deste Contrato;

3.7 A CONTRATANTE deverá efetuar o pagamento na forma e condições estabelecidas na Cláusula Sexta deste instrumento;

3.8 Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência, direta ou indireta, deste contrato e de sua execução serão de exclusiva responsabilidade do contribuinte, assim definido na forma tributária, sem direito à reembolso. A CONTRATANTE, quando na fonte retentora, descontará e recolherá, nos prazos da Lei, os tributos a que esteja obrigada pela legislação vigente.

CLÁUSULA QUARTA - OBRIGAÇÕES DA CONTRATADA

4.1 A CONTRATADA deverá realizar e cumprir os serviços solicitados pela CONTRATANTE conforme a descrição do objeto do contrato;

4.2 A CONTRATADA tem total propriedade e responsabilidade pela criação, administração e gerenciamento das campanhas publicitárias, conforme a Cláusula 11.1 dos Direitos Autorais, sendo VEDADO à CONTRATANTE qualquer alteração nas mesmas. Qualquer alteração nas campanhas publicitárias por parte CONTRATANTE sem a permissão da CONTRATADA, resultará em infringimento deste contrato e será passivo de anulação do mesmo;

4.3 A CONTRATADA se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, informações e documentos da CONTRATANTE, mesmo após a conclusão dos serviços ou do término da relação contratual;

4.4 Os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados, pela CONTRATADA, por seus funcionários ou contratados, estritamente para cumprimento dos serviços solicitados pela CONTRATANTE, sendo VEDADO a comercialização ou utilização para outros fins;

4.5 Será de responsabilidade da CONTRATADA todo o ônus trabalhista ou tributário referente aos funcionários utilizados para a prestação do serviço objeto deste instrumento, ficando a CONTRATANTE isenta de qualquer obrigação em relação a eles;

4.6 Será de responsabilidade da CONTRATADA respeitar a legislação vigente aplicável à atividade publicitária, criando anúncios dentro das normas previstas no Código Brasileiro de Autorregulamentação Publicitária (CONAR) e no Código de Defesa do Consumidor.

A CONTRATADA não se responsabiliza:

4.7 Pelo mal funcionamento de serviço ou ferramentas de terceiros, compatibilidade entre navegadores de internet, plataformas de anúncios, ferramentas de busca, ou outros serviços que gerem qualquer tipo de perda ou falta de disponibilidade do serviço prestado à CONTRATANTE;

4.8 Por eventuais mudanças nas diretrizes das plataformas de anúncios;

4.9 Por eventuais bloqueios temporários ou permanentes sofridos nas plataformas de anúncios por engano, ou devido à algum anúncio que a CONTRATANTE insistiu em veicular e estava em desacordo com as diretrizes das plataformas;

4.10 Uma vez que a CONTRATANTE é responsável pelo conteúdo dos materiais dos anúncios fornecidos, a CONTRATADA não se responsabiliza se o texto, imagem ou vídeo for ilegal ou transgredir direitos de terceiros;

4.11 A CONTRATADA não garante a CONTRATANTE um número específico de clientes captados através de seus serviços mensalmente, tendo em vista que é uma variável, devido a vários fatores externos que podem vir a influenciar nos resultados, como instabilidade nas plataformas, alterações na distribuição dos anúncios pela plataforma, períodos com maior quantidade de anunciantes que influenciam no leilão do "Facebook Business" e nas demais plataformas de anúncios online, entre outros. Pode-se esperar, uma média de 80 a 120 contatos por mês, mas isso não é regra, serve apenas como base.;

4.12 A CONTRATADA não garante que os anúncios sejam mostrados e estejam sempre visíveis cada vez que as Plataformas forem abertas, tendo em vista que eles são exibidos de forma rotativa pelas Plataformas.

CLÁUSULA QUINTA - DOS SERVIÇOS

5.1 A CONTRATADA atuará na prestação de serviços especificamente descritos a seguir:

5.1.1 A criação e gerenciamento de campanhas de marketing mensal através da plataforma "Facebook Business";

5.1.2 O acompanhamento do desempenho de cada campanha, assegurando a melhor cobertura dos públicos e/ou dos mercados objetivados;

5.1.3 Quando não recebido o material necessário para uso nas campanhas de marketing pela CONTRATANTE, a CONTRATADA utilizará imagens ou vídeos de domínio público;

5.1.4 O monitoramento do engajamento do público e produção de relatórios semanais baseados nos resultados apresentados pelas próprias plataformas;

5.1.5 O treinamento com a equipe de vendas através da aula "Como ter bom resultado com a assessoria" e também a metrificação dos resultados e performance da equipe através do monitoramento semanal dos números do funil de vendas.;

5.1.6 A entrega de um script de persuasão em linha reta para melhor performance do time de prospecção.

${clausulaSexta}

6.2 Pelos serviços nas plataformas de publicidade online, será devido o valor mensal escolhido pelo contratante onde este deverá ser pago às plataformas via Boleto Bancário enviado por Whatsapp;

6.3 O vencimento da primeira parcela dos valores indicados nos itens 6.1 terão vencimento em ${d.data_vencimento}, e as demais, no mesmo dia dos meses subsequentes, devendo ser pagas mediante emissão de fatura pela CONTRATADA com no mínimo 05 (cinco) dias de antecedência à data do vencimento;

6.4 Os pagamentos dos Boletos, tanto da Taxa de Serviço e da Plataforma de Anúncios, levam até 02 (dois) dias úteis para serem processados pelos sistemas. Após o recebimento dos pagamentos, a CONTRATADA deverá iniciar o serviço contratado em até 48 (quarenta e oito) horas úteis após os criativos estiverem prontos;

6.5 O atraso no pagamento das quantias devidas implicará a incidência de multa moratória equivalente a 2% (dois por cento) do valor devido e não pago, acrescido de juros de mora de 1% (um por cento) ao mês, pro rata dies, e correção monetária pelo IGPM/FGV até a data do efetivo pagamento;

6.6 Não confirmado o pagamento das quantias devidas em até 05 (cinco) dias úteis, o serviço será interrompido até que a CONTRATANTE efetue o pagamento;

6.7 Fica assegurado a CONTRATANTE o direito de rescindir o contrato, se decorrer de 30 (trinta) dias da assinatura do contrato, não ocorrer por parte da CONTRATADA, os serviços neste instrumento citados, ficando à CONTRATADA o dever de devolver o valor referente à Taxa de Prestação de Serviços;

6.7.1 Não será devolvido o valor referente ao investimento nas plataformas de publicidade online;

6.7.2 A CONTRATANTE fica ciente que a CONTRATADA somente realizará os serviços que constam neste contrato, sendo qualquer pedido de serviço adicional cobrado separadamente, mediante a prévia autorização da CONTRATANTE.

CLÁUSULA SÉTIMA - DO PRAZO

7.1 Este acordo terá vigência de 90 (noventa) dias a contar da assinatura do presente contrato, renovável automaticamente por períodos iguais e sucessivos, salvo aviso prévio com 15 (quinze) dias de antecedência à cada data de renovação contratual.

CLÁUSULA OITAVA - DA RESCISÃO

8.1 O presente contrato poderá ser rescindido por qualquer das partes imediatamente, independente de notificação judicial ou extrajudicial, em caso de falência, concordata, dissolução ou liquidação de qualquer das partes, bem como se estas apresentarem em situação de insolvência;

8.2 Caso a CONTRATANTE decida pela rescisão do Contrato, de forma unilateral e imotivada, antes do término de sua vigência, esta deverá comunicar de sua intenção à CONTRATADA e a data desejada para o término da contratação, devendo proceder a CONTRATANTE com o pagamento de uma multa correspondente a 35% (trinta e cinco por cento) das parcelas vincendas do contrato;

8.3 Na hipótese de rescisão contratual pela CONTRATANTE de forma unilateral e imotivada, não haverá a devolução de qualquer valor por parte da CONTRATADA.

CLÁUSULA NONA - DA NÃO EXCLUSIVIDADE

9.1 O serviço é prestado em caráter NÃO EXCLUSIVO, eis que a CONTRATADA pode captar clientes para outras empresas, sem qualquer vínculo de preferência ou exclusividade com a CONTRATANTE. Assim como, a CONTRATANTE poderá contratar outros prestadores de serviços que desenvolvam atividades de igual finalidade da CONTRATADA.

CLÁUSULA DÉCIMA - DO SIGILO / CONFIDENCIALIDADE

10.1 As partes convencionam que toda e qualquer informação transferida entre elas será considerada confidencial e privilegiada, e não será divulgada a terceiros sem o expresso consentimento das partes.

10.2 A CONTRATADA garante o sigilo e tratamento dos dados pessoais da CONTRATANTE de acordo com a Lei n. 13.709/2018, Lei Geral de Proteção de Dados Pessoais (LGPD).

10.2.1 A CONTRATADA não se responsabiliza em caso de vazamento de dados pessoais por parte da CONTRATANTE ou de terceiros sem qualquer vínculo com a CONTRATADA.

10.2.2 A CONTRATANTE, autoriza o fornecimento e uso de seus dados, com a finalidade de formalizar esse contrato, estando ciente e de acordo com todos os dados neste preenchidos, nos termos da Lei n. 13.709/2018, Lei Geral de Proteção de Dados Pessoais.

10.2.3 As Partes retro qualificadas firmaram em ${dataExtenso} o instrumento particular de CONTRATO DE PRESTAÇÃO DE SERVIÇO / E OBRIGAÇÕES.

10.3 Considerando ter havido interesse recíproco entre a CONTRATANTE e a CONTRATADA, serve-se do presente aditivo para:

10.3.1 As Partes comprometem-se a reter a menor quantidade possível de dados e registros e excluí-los (i) tão logo atingida a finalidade de seu uso ou (ii) se encerrando o prazo determinado por obrigação legal, conforme preceitua o disposto no artigo 13, §2º da Lei do Marco Civil da Internet. As Partes se obrigam a realizar o tratamento de dados pessoais de acordo com as disposições legais vigentes, bem como nos moldes da Lei 13.709/2018, a Lei Geral de Proteção de Dados Pessoais (LGPD), visando dar efetiva proteção aos dados coletados de pessoas naturais que possam identificá-las ou torná-las identificáveis, utilizando-os de tais dados tão somente para os fins necessários à consecução do objeto deste Contrato, ou nos limites do consentimento expressamente manifestado por escrito por seus respectivos titulares.

Parágrafo primeiro - A CONTRATADA deverá, considerando os meios tecnológicos disponíveis e adequados às suas atividades, a natureza dos dados armazenados e os riscos a que estão expostos, adotar medidas físicas e lógicas, de caráter técnico e organizacional, para prover confidencialidade e segurança dos dados de modo a evitar sua alteração, perda, subtração e acesso não autorizado, bem como a violação da privacidade dos sujeitos titulares dos dados.

Parágrafo segundo - A CONTRATADA procederá com os serviços de forma a viabilizar a observância pela CONTRATANTE às regras da LGPD.

Parágrafo terceiro - As Partes concordam que o consentimento do titular no fornecimento de dados deverá ser livre, informado, inequívoco e relacionado a uma determinada finalidade.

Parágrafo quarto - As Partes se comprometem mutuamente ao cumprimento da LGPD, sempre que solicitado ou necessário, além de utilizar os serviços seguindo às regras aplicáveis em relação ao tratamento de dados coletados.

10.4 Contrato firmado, será acrescentado da seguinte forma referente à CONFIDENCIALIDADE: A CONTRATANTE afirma não ceder a qualquer título a terceiros os dados pessoais das partes e dos clientes da CONTRATADA, respeitando sua privacidade, utilizando-os apenas para fins lícitos e expressamente nominados e autorizados pelos mesmos, adotando as melhores posturas e práticas com o fim de dar cumprimento às regras e princípios previstos na Lei Geral de Proteção de Dados Pessoais - LGPD (Lei n. 13.709/2018).

CLÁUSULA DÉCIMA PRIMEIRA - DOS DIREITOS AUTORAIS

11.1 Todos os recursos, páginas de captura, arquivos, campanhas publicitárias e demais ferramentas que foram elaborados para o cumprimento do serviço contratado são de propriedade da CONTRATADA, reservando-se a mesma os direitos autorais, não podendo estes materiais serem copiados, reproduzidos, mudados, utilizados ou disponibilizados para terceiros, em todo ou em parte, sem sua expressa autorização, sob pena de multa e indenização prevista na Lei nº 9610/98, que dispõe sobre os Direitos Autorais;

11.2 Os Direitos Autorais de toda a arte enviada pela CONTRATANTE para a realização dos serviços contratados, serão de propriedade da mesma.

CLÁUSULA DÉCIMA SEGUNDA - DA TRANSPARÊNCIA

12.1 Todos os dados pessoais da CONTRATANTE, coletados para a realização do serviço objeto deste Contrato, poderão ser solicitados pela mesma, seja para verificação, alteração ou exclusão se necessário, através do e-mail contato@salxdigital.com.br, conforme a Lei n. 13.709/2018, Lei Geral de Proteção de Dados Pessoais.

12.1.1 Os dados da CONTRATANTE só serão excluídos do sistema da CONTRATADA em caso de rescisão ou cancelamento deste Contrato.

12.1.2 Caso haja rescisão ou cancelamento do Contrato, todos os dados da CONTRATANTE serão excluídos do sistema da CONTRATADA imediatamente.

12.2 Os dados coletados pela CONTRATADA para a prestação de serviço objeto deste Contrato, serão encaminhados para a CONTRATANTE através de E-mail e uma Planilha Mensal. Os dados serão excluídos do sistema da CONTRATADA após o prazo de 60 (sessenta) dias.

CLÁUSULA DÉCIMA TERCEIRA - DO DEVER DE COMUNICAÇÃO DE INCIDENTES

13.1 A CONTRATADA (o operador) deverá comunicar à CONTRATANTE (o controlador), o mais breve possível, a ocorrência de qualquer incidente de segurança relacionado ao tratamento de dados pessoais, objeto do presente contrato.

Parágrafo único - a comunicação deverá ocorrer, simultaneamente, para o e-mail contato@salxdigital.com e para o telefone (51) 989634041

CLÁUSULA DÉCIMA QUARTA - DAS DISPOSIÇÕES GERAIS

14.1 As partes são contratantes totalmente independentes, sendo cada uma inteiramente responsável por seus atos, obrigações e conteúdo das informações prestadas, em toda e qualquer circunstância, visto que o presente instrumento não cria vínculo trabalhista, nem de representação comercial entre as mesmas, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATADA e CONTRATANTE qualquer tipo de relação de subordinação. Sendo assim, nenhuma delas poderá declarar que possui qualquer autoridade para assumir ou criar qualquer obrigação, expressa ou implícita, em nome da outra, e nem representá-la sob qualquer circunstância e em nenhuma situação;

14.2 Os signatários do presente contrato asseguram e afirmam que são os representantes legais competentes para assumir em nome das partes as obrigações descritas neste contrato e representar de forma efetiva seus interesses;

14.3 As partes estipulam que a presente contratação é obrigação de meio, não de resultado, onde as mesmas poderão estipular metas a serem perseguidas, mas tendo em vista que os resultados podem variar devido a vários fatores externos, como citado no item 4.11 da Cláusula Quarta, inclusive também, pela estratégia a ser adotada, delineada de comum acordo entre as partes e o espaço territorial escolhido pela CONTRATANTE.

14.4 A impossibilidade de prestação do serviço causada por incorreção em informação fornecida pela CONTRATANTE ou por omissão no provimento de informação essencial à prestação, não caracterizará descumprimento de obrigação por parte da CONTRATADA;

14.5 Através do presente contrato, a CONTRATANTE permite que a CONTRATADA cite o nome e o logotipo da mesma com a finalidade exclusivamente institucional.

CLÁUSULA DÉCIMA QUINTA - DO FORO

15.1 Para dirimir eventuais dúvidas e litígios oriundos do presente contrato, as partes elegem o foro da Comarca de Campo Bom do Estado do Rio Grande do Sul.`;
}

function quebrarTexto(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function adicionarRubrica(page: any, font: any, margin: number, pageWidth: number) {
  const y = 30;
  const col1 = margin + 40;
  const col2 = pageWidth - margin - 140;
  page.drawLine({ start: { x: col1 - 30, y: y + 12 }, end: { x: col1 + 80, y: y + 12 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: col2 - 30, y: y + 12 }, end: { x: col2 + 80, y: y + 12 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawText("CONTRATADA", { x: col1 - 10, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText("CONTRATANTE", { x: col2 - 10, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
}

async function gerarPDF(texto: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const titleSize = 13;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const paragraphs = texto.split("\n");

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      y -= lineHeight;
      if (y < margin + 40) {
        adicionarRubrica(page, font, margin, pageWidth);
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      continue;
    }

    const isTitle = /^(CONTRATO DE PRESTAÇÃO|CLÁUSULA|Parágrafo|A CONTRATADA não se responsabiliza)/.test(trimmed);
    const usedFont = isTitle ? fontBold : font;
    const usedSize = trimmed === "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL" ? titleSize : fontSize;

    const lines = quebrarTexto(trimmed, usedFont, usedSize, maxWidth);
    for (const line of lines) {
      if (y < margin + 40) {
        adicionarRubrica(page, font, margin, pageWidth);
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: usedSize, font: usedFont, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
    y -= 4;
  }

  adicionarRubrica(page, font, margin, pageWidth);

  return doc.save();
}

export async function POST(req: NextRequest) {
  try {
    const body: ContratoPayload = await req.json();

    if (!body.nome || !body.valor) {
      return NextResponse.json({ error: "Nome e valor são obrigatórios" }, { status: 400 });
    }

    const texto = gerarTextoContrato(body);
    const pdfBytes = await gerarPDF(texto);

    const nomeDoc = `Contrato - ${body.nome}`;

    const operations = JSON.stringify({
      query: `mutation CreateDocumentMutation(
        $document: DocumentInput!,
        $signers: [SignerInput!]!,
        $file: Upload!
      ) {
        createDocument(
          document: $document,
          signers: $signers,
          file: $file
        ) {
          id
          name
          signatures {
            public_id
            name
            email
            action { name }
          }
        }
      }`,
      variables: {
        document: { name: nomeDoc },
        signers: [
          {
            email: "gustavosantos1gu9@gmail.com",
            action: "SIGN",
            name: "Gustavo Guilherme Silva dos Santos",
          },
          {
            email: body.email,
            action: "SIGN",
            name: body.nome,
          },
        ],
        file: null,
      },
    });

    const map = JSON.stringify({ file: ["variables.file"] });

    const formData = new FormData();
    formData.append("operations", operations);
    formData.append("map", map);
    formData.append("file", new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }), `${nomeDoc}.pdf`);

    const response = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AUTENTIQUE_TOKEN}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.errors) {
      console.error("Autentique errors:", result.errors);
      return NextResponse.json({ error: result.errors[0]?.message || "Erro no Autentique" }, { status: 500 });
    }

    return NextResponse.json({ success: true, documento: result.data?.createDocument });
  } catch (err: any) {
    console.error("Erro ao gerar contrato:", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
