export function passwordResetTemplate(resetUrl: string, name: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#C62828;padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">🍕 Recuperar Contraseña</h1>
    </div>

    <div style="padding:30px;">
      <p style="font-size:16px;color:#333;">Hola <strong>${name}</strong>,</p>
      <p style="color:#555;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
      <p style="color:#555;">Hacé clic en el botón para crear una nueva contraseña. Este enlace expira en 1 hora.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#C62828;color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">Restablecer contraseña</a>
      </div>

      <p style="color:#999;font-size:13px;">Si no solicitaste esto, ignorá este email. Tu contraseña no cambiará.</p>
      <p style="color:#999;font-size:12px;word-break:break-all;">O copiá este enlace: ${resetUrl}</p>
    </div>

    <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999;">
      <p style="margin:0;">© ${new Date().getFullYear()} Pizzería. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}
