import QRCode from 'qrcode';

export interface QrCardOptions {
  tableNumber: number;
  tableLabel?: string;
  area?: string;
  venueName?: string;
  qrUrl: string;
}

/**
 * Generates a clean PNG canvas matching the printable QR card format:
 * - Venue Name (bold serif header at top)
 * - MENU
 * - Table / Area label (e.g. TABLE 01 · PATIO)
 * - OPEN YOUR CAMERA APP
 * - ✦ SCAN THIS QR CODE TO SEE OUR MENU
 * - Centered QR Code
 */
export async function generatePrintableQrCanvas(options: QrCardOptions): Promise<HTMLCanvasElement> {
  const { tableNumber, tableLabel, area, venueName, qrUrl } = options;

  const width = 700;
  const height = 920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Clean White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let currentY = 55;

  // 1. Top Header: Venue Name (or fallback to BYSEN)
  const venueText = (venueName && venueName.trim() ? venueName.trim() : 'BYSEN').toUpperCase();
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 52px "Georgia", "Times New Roman", serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(venueText, width / 2, currentY);

  currentY += 75;

  // 2. Sub-Header: MENU
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('MENU', width / 2, currentY);

  currentY += 45;

  // 3. Table / Area info
  const tableTitle = tableLabel || `TABLE ${String(tableNumber).padStart(2, '0')}`;
  const tableDetail = area ? `${tableTitle.toUpperCase()} · ${area.toUpperCase()}` : tableTitle.toUpperCase();

  ctx.fillStyle = '#555555';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(tableDetail, width / 2, currentY);

  currentY += 55;

  // 4. Streamlined Call to Action
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('SCAN TO ORDER', width / 2, currentY);

  currentY += 50;

  // 5. Middle: Render QR Code centered
  const qrSize = 480;
  const tempQrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempQrCanvas, qrUrl, {
    width: qrSize,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  const qrX = (width - qrSize) / 2;
  ctx.drawImage(tempQrCanvas, qrX, currentY, qrSize, qrSize);

  return canvas;
}

/**
 * Triggers a file download of the PNG printable QR card.
 */
export async function downloadPrintableQrCard(options: QrCardOptions): Promise<void> {
  const canvas = await generatePrintableQrCanvas(options);
  const a = document.createElement('a');
  const tableNum = String(options.tableNumber).padStart(2, '0');
  a.href = canvas.toDataURL('image/png');
  a.download = `table-${tableNum}-qr.png`;
  a.click();
}

