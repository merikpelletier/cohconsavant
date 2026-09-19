import { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';

export default function ProxiedImage({ src, className, style }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
    // If it's already a data URL or external non-appClient URL, use directly
    if (src.startsWith('data:') || !src.includes('appClient.app/api/apps')) {
      setDataUrl(src);
      return;
    }
    let cancelled = false;
    appClient.functions.invoke('proxyImage', { url: src }).then(res => {
      if (!cancelled) setDataUrl(res.data.dataUrl);
    }).catch(() => {
      if (!cancelled) setDataUrl(src); // fallback
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!dataUrl) return <div className={className} style={style} />;

  return (
    <div
      className={className}
      style={{ ...style, backgroundImage: `url("${dataUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  );
}