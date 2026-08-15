export function whatsappLink(number: string): string {
  const digits = number.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}`;
}

export function directionsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
