// Lógica de doble autenticación (2FA) con apps tipo Google Authenticator / Authy.
// Usa el estándar TOTP (código de 6 dígitos que cambia cada 30 segundos) — gratis, sin
// depender de ningún servicio externo de pago (a diferencia de SMS o WhatsApp).
//
// Nota: usa la API actual de otplib v13 (generateSecret / verify / generateURI como
// funciones sueltas) — versiones anteriores usaban un objeto "authenticator" que ya no existe.
import { generateSecret, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';

// Genera un secreto nuevo y único para un usuario — se guarda una sola vez en la base de
// datos, la primera vez que activa 2FA.
export function generarSecreto() {
  return generateSecret();
}

// Genera la imagen QR (como data URL, lista para meter en un <img src="...">) que la app
// autenticadora escanea para vincularse con la cuenta.
export async function generarQR(email, secreto) {
  const otpauth = generateURI({ issuer: 'SFL FIHNEC', label: email, secret: secreto });
  return QRCode.toDataURL(otpauth);
}

// Verifica que el código de 6 dígitos que escribió la persona sea válido para ese secreto,
// en este momento. (verify() de otplib v13 es asíncrona, por eso esta función también lo es.)
export async function verificarCodigo(codigo, secreto) {
  try {
    const resultado = await verify({ secret: secreto, token: String(codigo || '').trim() });
    return resultado.valid;
  } catch {
    return false;
  }
}
