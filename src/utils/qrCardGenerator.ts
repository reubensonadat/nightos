import QRCode from 'qrcode';

export interface QrCardOptions {
  tableNumber: number;
  tableLabel?: string;
  area?: string;
  venueName?: string;
  qrUrl: string;
}

/**
 * Generates a clean PNG canvas containing Table Name/Number at top, QR code in middle, and "SCAN TO ORDER" at bottom.
 */
export async function generatePrintableQrCanvas(options: QrCardOptions): Promise<HTMLCanvasElement> {
  const { tableNumber, tableLabel, area, qrUrl } = options;

  const width = 600;
  const height = 760;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Clean White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 1. Top Header: Table Name and Number
  const titleText = tableLabel || `Table ${String(tableNumber).padStart(2, '0')}`;
  const headerText = area ? `${titleText} · ${area}` : titleText;

  ctx.fillStyle = '#23140C';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(headerText, width / 2, 45);

  // 2. Middle: Render QR Code centered
  const tempQrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempQrCanvas, qrUrl, {
    width: 480,
    margin: 1,
    color: {
      dark: '#23140C',
      light: '#FFFFFF',
    },
  });

  ctx.drawImage(tempQrCanvas, 60, 110, 480, 480);

  // 3. Bottom: Text "SCAN TO ORDER"
  ctx.fillStyle = '#4E5340';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '3px';
  ctx.fillText('SCAN TO ORDER', width / 2, 635);

  return canvas;
}

/**
 * Triggers a file download of the PNG containing Table Name/Number + QR code + "SCAN TO ORDER" text.
 */
export async function downloadPrintableQrCard(options: QrCardOptions): Promise<void> {
  const canvas = await generatePrintableQrCanvas(options);
  const a = document.createElement('a');
  const tableNum = String(options.tableNumber).padStart(2, '0');
  a.href = canvas.toDataURL('image/png');
  a.download = `table-${tableNum}-qr.png`;
  a.click();
}
