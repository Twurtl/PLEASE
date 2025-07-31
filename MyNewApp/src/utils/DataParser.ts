export interface ParsedPacket {
  timestamp: number;
  voltages: number[];
}

const parseRawPacket = (raw: string): ParsedPacket | null => {
  // Format: "T:1698765432,V:2.34,2.45,2.12,..."
  try {
    const parts = raw.split(',');
    const tPart = parts.shift();
    if (!tPart?.startsWith('T:')) return null;
    const ts = parseInt(tPart.substring(2), 10);
    const voltages = parts
      .map(p => p.replace(/^V:/, ''))
      .map(str => parseFloat(str));
    return { timestamp: ts, voltages };
  } catch {
    return null;
  }
};

export default parseRawPacket;
