import { emailBaseStyles, recoveryStyles } from './styles/email.styles';

export function getPasswordRecoveryTemplate(nombre: string, code: string, logoUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de contraseña</title>
  <style>
    ${emailBaseStyles}
    ${recoveryStyles}
  </style>
</head>
<body>
  <div class="container">

    <div class="header" style="background-color: #1a1a1a; border-radius: 8px 8px 0 0; padding: 24px; margin: -40px -40px 30px -40px;">
      <img src="${logoUrl}" alt="IEEE MTT-S BPC Workshop" style="max-width: 320px; height: auto; display: block; margin: 0 auto;" />
      <h1 style="color: #ffffff; margin-top: 16px; font-size: 22px;">🔐 Recuperación de Contraseña</h1>
    </div>

    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Has solicitado restablecer tu contraseña. Utiliza el siguiente código para continuar:</p>

    <div class="code-box">
      <div style="color: #6f6f6e; font-size: 14px; margin-bottom: 10px;">Tu código de verificación es:</div>
      <div class="code">${code}</div>
    </div>

    <p style="text-align: center; color: #6f6f6e;">
      <strong>Este código expirará en 15 minutos</strong>
    </p>

    <div class="warning">
      <strong>⚠️ Importante:</strong> Si no solicitaste este cambio, ignora este mensaje. Tu cuenta permanecerá segura.
    </div>

    <p style="margin-top: 30px;">
      Por seguridad, nunca compartas este código con nadie. Nuestro equipo nunca te pedirá este código por teléfono o email.
    </p>

    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
      <p style="color: #6f6f6e; font-size: 12px;">© ${new Date().getFullYear()} IEEE UTN. Todos los derechos reservados.</p>
    </div>

  </div>
</body>
</html>
  `;
}