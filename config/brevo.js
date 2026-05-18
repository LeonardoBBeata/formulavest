const SibApiV3Sdk = require('@getbrevo/brevo');

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();

brevo.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

module.exports = brevo;
