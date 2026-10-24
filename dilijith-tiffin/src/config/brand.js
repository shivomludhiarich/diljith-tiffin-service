// Edit business details here.
import logo from '../assets/logo/logo.jpg';
import { buildWhatsappUrl, cleanNumber } from '../utils/whatsapp';

const rawEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_WHATSAPP_NUMBER : undefined;
const whatsappNum = cleanNumber(rawEnv || '918699476361');
const defaultMessage = 'Hi! I would like to know more about Diljit Tiffin Service.';
const whatsappUrl = buildWhatsappUrl(whatsappNum, defaultMessage);

export const BRAND = {
  name: 'Dilijith Tiffin Service',
  tagline: 'Authentic North Indian food, delivered fresh',
  logo,
  contact: {
    phone: '86994 76361',
    email: 'contact@dilijithtiffin.com',
    address: 'Indiranagar, Bengaluru, Karnataka 560038',
  },
  whatsappNumber: whatsappNum,
  whatsappMessage: defaultMessage,
  social: [
    { label: 'Instagram', href: '#' },
    { label: 'Facebook', href: '#' },
    { label: 'WhatsApp', href: whatsappUrl },
  ],
};

/** Guaranteed WhatsApp URL linking to business chat. */
export const WHATSAPP_URL = whatsappUrl;
