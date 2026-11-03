import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { useLanAddresses } from '@/shared/api/networkApi';
import { buildJoinUrl } from '@/shared/lib/joinUrl';

/** QR code of the join link, built on the server's LAN address rather than localhost. */
export const JoinQrCode = ({ code }: { code: string }) => {
  const lan = useLanAddresses();
  const [svg, setSvg] = useState<string | null>(null);

  const joinUrl = lan.isPending
    ? null
    : buildJoinUrl(code, new URL(window.location.href), lan.data?.addresses[0]);

  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    void QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(
      (markup) => {
        if (!cancelled) setSvg(markup);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  if (!joinUrl || !svg) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={`QR code to join the game: ${joinUrl}`}
        className="size-44 rounded-xl border-2 bg-white p-1 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="max-w-44 break-all text-center font-mono text-xs text-muted-foreground">
        {joinUrl}
      </p>
    </div>
  );
};
