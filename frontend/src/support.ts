import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/** Open WhatsApp chat with the given phone (E.164 without leading +).
 * Example: openWhatsApp('5519988371125', 'Olá!') */
export async function openWhatsApp(phone: string, message?: string) {
  const clean = phone.replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(message || '');
  const url = `https://wa.me/${clean}${message ? `?text=${encoded}` : ''}`;
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    }
  }
}

export async function copyText(text: string) {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export const WEEKDAY_LABEL = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
export const WEEKDAY_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
