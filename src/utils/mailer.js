const nodemailer = require('nodemailer');
const config = require('../config');
const jwt = require('jsonwebtoken');
const path = require('path');

// Criar o transporter apenas se as variaveis estiverem configuradas
let transporter = null;

if (config.SMTP_USER && config.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail', // Vamos forcar o servico para gmail conforme solicitado
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    }
  });
} else {
  console.warn('AVISO: SMTP_USER e SMTP_PASS nao estao configurados. O envio de e-mails esta desabilitado.');
}

/**
 * Envia um e-mail HTML generico
 */
async function enviarEmailHTML(to, subject, html, attachments = []) {
  if (!transporter) {
    console.warn('E-mail nao enviado (transporter nao configurado).', { to, subject });
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: config.SMTP_FROM || config.SMTP_USER,
      to,
      subject,
      html,
      attachments
    });
    console.log(`[E-MAIL] E-mail enviado para ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[E-MAIL] Erro ao enviar e-mail para ${to}:`, error);
    return false;
  }
}

/**
 * Monta e envia o e-mail de Novo Pedido (Backoffice)
 */
async function enviarEmailPedido(to, sessao, solicitacaoId, resumoTexto, nomeAdmin, exibirBotaoBaixar = true) {
  const subject = `NOVO PEDIDO DE PEÇA - #${solicitacaoId} - ${sessao.tecnico_nome}`;
  
  const baseUrl = config.BASE_URL;
  const tokenPayload = { id: solicitacaoId, user: nomeAdmin || 'E-mail' };
  const token = jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn: '7d' });
  const linkBaixa = `${baseUrl}/api/baixar-email?token=${token}`;

  let mdAlertHtml = '';
  if (sessao.md === 'Sim' || sessao.md === '1') {
    mdAlertHtml = `<div style="background-color: #5c3e41; border-left: 5px solid #d32f2f; padding: 15px; margin-bottom: 25px; border-radius: 4px; color: #ff8a80; font-weight: bold; font-size: 16px;">
      🚨 ATENÇÃO: Equipamento em Máquina Parada (MD)!
    </div>`;
  }

  let diretrizHtml = '';
  const modeloUpper = (sessao.modelo || '').toUpperCase();
  if (modeloUpper.includes('CIF')) {
    diretrizHtml = `<div style="background-color: #5c3e41; border-left: 5px solid #d32f2f; padding: 15px; border-radius: 4px; color: #ff8a80; font-weight: bold; margin-bottom: 15px;">
      <span style="font-size: 16px;">🛑 DIRETRIZ:</span><br>
      <span style="color: #ffcc80;">👉 Fature a peça (Contrato CIF)</span>
    </div>`;
  } else if (modeloUpper.includes('CAREPACK')) {
    diretrizHtml = `<div style="background-color: #5c3e41; border-left: 5px solid #d32f2f; padding: 15px; border-radius: 4px; color: #ff8a80; font-weight: bold; margin-bottom: 15px;">
      <span style="font-size: 16px;">🛑 DIRETRIZ:</span><br>
      <span style="color: #ffcc80;">👉 Enviar orçamento de Nacionalização</span>
    </div>`;
  } else if (modeloUpper.includes('VENDA')) {
    diretrizHtml = `<div style="background-color: #5c3e41; border-left: 5px solid #d32f2f; padding: 15px; border-radius: 4px; color: #ff8a80; font-weight: bold; margin-bottom: 15px;">
      <span style="font-size: 16px;">🛑 DIRETRIZ:</span><br>
      <span style="color: #ffcc80;">👉 Enviar orçamento de venda</span>
    </div>`;
  }

  let diretrizEdiculaHtml = '';
  const itensNaEdicula = sessao.itens_consultados.filter(i => i.isEdicula && i.quantidadeDesejada > 0);
  if (itensNaEdicula.length > 0) {
    let listEdicula = '';
    itensNaEdicula.forEach(i => {
      listEdicula += `<br>&nbsp;&nbsp;&nbsp; - ${i.codigo}: Localização -> ${i.localizacao || 'N/A'}`;
    });
    diretrizEdiculaHtml = `<div style="background-color: #5c3e1b; border-left: 5px solid #d35400; padding: 15px; border-radius: 4px; color: #ffb74d; font-weight: bold; margin-bottom: 15px;">
      <span style="font-size: 16px;">🛑 DIRETRIZ:</span><br>
      <span style="color: #ffffff;">👉 PEÇA ENCONTRADA NA EDÍCULA</span>${listEdicula}
    </div>`;
  }

  let itensHtml = '';
  sessao.itens_consultados.forEach(i => {
    if (i.quantidadeDesejada > 0) {
      const isImport = i.importacao ? '[! Importar] ' : '';
      const isRedundante = i.alerta_redundancia ? `[ALERTA: Solicitada há menos de 15 dias por ${i.alerta_redundancia}] ` : '';
      
      let ediculaTag = '';
      if (i.isEdicula) {
        ediculaTag = `<span style="background-color: #d35400; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-right: 5px;">EDÍCULA - Loc: ${i.localizacao || 'N/A'}</span> `;
      }

      itensHtml += `<div style="background-color: #333333; border-left: 4px solid #1e6e28; padding: 12px; margin-bottom: 10px; border-radius: 2px;">
        ${ediculaTag}${isImport}${isRedundante}${i.codigo} | ${i.descricao} | Qtd solicitada: ${i.quantidadeDesejada} | ${sessao.urgencia}
      </div>`;
    }
  });

  const finalidadeStr = sessao.motivo === 'Diagnóstico' || sessao.motivo === '2' ? 'Para Diagnóstico' : 'Para Atendimento';

  let botaoBaixarHtml = '';
  if (exibirBotaoBaixar) {
    botaoBaixarHtml = `
        <div style="text-align: center; margin-top: 35px; margin-bottom: 15px;">
          <a href="${linkBaixa}" style="display: inline-block; background-color: #115719; color: #ffffff; padding: 16px 32px; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 4px; border: 1px solid #1e6e28; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            ✅ DAR BAIXA NESTE PEDIDO
          </a>
        </div>
        <p style="text-align: center; color: #888888; font-size: 12px;">
          Ao clicar no botão acima, o pedido será baixado automaticamente do sistema.
        </p>
    `;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #2c2c2c; border: 1px solid #444; border-radius: 8px; overflow: hidden; color: #e0e0e0;">
      
      <!-- HEADER -->
      <div style="background-color: #1e6e28; padding: 25px 20px; text-align: center;">
        <img src="cid:mascotelogo" style="max-width: 120px; border-radius: 8px; border: 2px solid #2ecc71;">
        <h2 style="color: #ffffff; margin: 15px 0 0 0; font-family: Arial, sans-serif; font-size: 22px;">Novo Pedido de Peças (#PD-${solicitacaoId})</h2>
      </div>
      
      <!-- BODY -->
      <div style="padding: 25px;">
        
        ${mdAlertHtml}
        
        <p style="margin: 8px 0;"><strong style="color: #ffffff;">Técnico:</strong> ${sessao.tecnico_nome}</p>
        <p style="margin: 8px 0;"><strong style="color: #ffffff;">Cliente:</strong> ${sessao.cliente}</p>
        <p style="margin: 8px 0;"><strong style="color: #ffffff;">Modelo:</strong> ${sessao.modelo}</p>
        <p style="margin: 8px 0;"><strong style="color: #ffffff;">Finalidade:</strong> ${finalidadeStr}</p>
        
        <h3 style="color: #ffffff; border-bottom: 2px solid #1e6e28; padding-bottom: 8px; margin-top: 30px;">Itens Solicitados</h3>
        
        ${diretrizHtml}
        ${diretrizEdiculaHtml}
        
        ${itensHtml}

        <div style="background-color: #435243; border: 1px solid #719371; padding: 15px; border-radius: 4px; margin-top: 25px; color: #ffffff; font-weight: bold; font-size: 16px;">
          📌 Protocolo #PD-${solicitacaoId}
        </div>

        ${botaoBaixarHtml}
      </div>
    </div>
  `;

  const attachments = [
    {
      filename: 'mascote.png',
      path: path.join(__dirname, '../../assets/mascote.png'),
      cid: 'mascotelogo'
    }
  ];

  return await enviarEmailHTML(to, subject, html, attachments);
}

module.exports = {
  enviarEmailHTML,
  enviarEmailPedido
};
