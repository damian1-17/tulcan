import { emailBaseStyles, changedStyles } from './styles/email.styles';

export function getPasswordChangedTemplate(nombre: string, logoSvg: string): string {  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contraseña actualizada</title>
  <style>
    ${emailBaseStyles}
    ${changedStyles}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">✅</div>
      <h1>Contraseña Actualizada</h1>
    </div>

    <p>Hola <strong>${nombre}</strong>,</p>

    <div class="success-box">
      <strong>Tu contraseña ha sido actualizada exitosamente</strong>
    </div>

    <p>Tu contraseña fue cambiada el <strong>${new Date().toLocaleString('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short',
    })}</strong>.</p>

    <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>

    <div class="warning">
      <strong>⚠️ ¿No fuiste tú?</strong><br>
      Si no realizaste este cambio, tu cuenta podría estar comprometida. Por favor, contacta inmediatamente a nuestro equipo de soporte.
    </div>

    <p style="margin-top: 30px;">Por tu seguridad, te recomendamos:</p>
    <ul>
      <li>Usar contraseñas únicas para cada servicio</li>
      <li>Cambiar tu contraseña periódicamente</li>
      <li>No compartir tus credenciales con nadie</li>
    </ul>

    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
      <p style="color: #6f6f6e; font-size: 12px;">© ${new Date().getFullYear()} IEEE UTN. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
  `;
}