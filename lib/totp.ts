import { authenticator } from "otplib";
import QRCode from "qrcode";

export function createTotpSecret(username: string) {
  const secret = authenticator.generateSecret();
  const issuer = process.env.TOTP_ISSUER ?? "App Data Center";
  const otpauth = authenticator.keyuri(username, issuer, secret);
  return { secret, otpauth };
}

export async function createTotpQrDataUrl(otpauth: string) {
  return QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
}

export function verifyTotp(token: string, secret: string) {
  return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
}
