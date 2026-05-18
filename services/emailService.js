const brevo = require('../config/brevo');

async function enviarEmail(
  para,
  assunto,
  texto,
  html = null
) {
  await brevo.sendTransacEmail({
    sender: {
      name: "FórmulaVest",
      email: process.env.EMAIL_FROM
    },
    to: [{ email: para }],
    subject: assunto,
    textContent: texto,
    htmlContent: html || `<p>${texto}</p>`
  });
}

module.exports = enviarEmail;
