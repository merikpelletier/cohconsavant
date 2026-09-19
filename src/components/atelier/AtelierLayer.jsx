import React from 'react';
import { Trash2, Copy } from 'lucide-react';

// A single draggable / resizable layer on the atelier canvas.
// Supports opacity, rotation, object-fit (image), and duplicate.
export default function AtelierLayer({ layer, selected, onSelect, onChange, onDelete, onDuplicate }) {
  const startDrag = (e) => {
    e.stopPropagation();
    onSelect(layer.id);
    const sx = e.clientX, sy = e.clientY;
    const ox = layer.x, oy = layer.y;
    const move = (ev) => onChange(layer.id, { x: Math.round(ox + ev.clientX - sx), y: Math.round(oy + ev.clientY - sy) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (e) => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const ow = layer.w, oh = layer.h;
    const move = (ev) => onChange(layer.id, { w: Math.max(24, Math.round(ow + ev.clientX - sx)), h: Math.max(24, Math.round(oh + ev.clientY - sy)) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startRotate = (e) => {
    e.stopPropagation();
    const el = e.currentTarget.parentElement;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const move = (ev) => {
      const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
      onChange(layer.id, { rotation: Math.round(ang) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      onPointerDown={startDrag}
      className={`absolute cursor-move select-none ${selected ? 'outline outline-2 outline-red-500' : ''}`}
      style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.zIndex ?? 1, opacity: layer.opacity ?? 1, transform: `rotate(${layer.rotation || 0}deg)` }}
    >
      {layer.type === 'image' ? (
        <img src={layer.url} alt="" draggable={false} className="w-full h-full pointer-events-none" style={{ objectFit: layer.objectFit || 'cover', borderRadius: layer.radius || 0 }} />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center pointer-events-none overflow-hidden"
          style={{
            fontSize: layer.fontSize || 18,
            color: layer.color || '#ffffff',
            fontWeight: layer.fontWeight || 700,
            textAlign: layer.align || 'center',
            fontFamily: layer.fontFamily || 'Georgia, serif',
            lineHeight: 1.1,
            whiteSpace: 'pre-wrap',
            letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : 'normal',
            textTransform: layer.uppercase ? 'uppercase' : 'none',
          }}
        >
          {layer.content || 'Texte'}
        </div>
      )}
      {selected && (
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
            className="absolute -top-3 -left-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <Trash2 size={12} className="text-white" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDuplicate(layer.id); }}
            className="absolute -top-3 left-4 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <Copy size={11} className="text-black" />
          </button>
          <div
            onPointerDown={startResize}
            className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full border-2 border-black cursor-se-resize shadow-lg"
          />
          <div
            onPointerDown={startRotate}
            className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-2 border-black cursor-grab shadow-lg"
          />
        </>
      )}
    </div>
  );
}