import { useMemo, useState } from 'react';
import { HONDURAS_GEO } from '../hondurasGeo';

export default function HondurasMapa({ datos }) {
  const [hover, setHover] = useState(null);

  const maxTotal = useMemo(() => Math.max(1, ...datos.map(d => d.total)), [datos]);
  const totalGeneral = useMemo(() => datos.reduce((s, d) => s + d.total, 0), [datos]);

  const colorPara = (total) => {
    if (!total) return '#EDE6D3'; // sin datos: tono neutro claro
    const intensidad = total / maxTotal;
    const r1 = 231, g1 = 184, b1 = 92;   // gold-light
    const r2 = 178, g2 = 58, b2 = 46;    // ember
    const r = Math.round(r1 + (r2 - r1) * intensidad);
    const g = Math.round(g1 + (g2 - g1) * intensidad);
    const b = Math.round(b1 + (b2 - b1) * intensidad);
    return `rgb(${r},${g},${b})`;
  };

  const [vbX, vbY, vbW, vbH] = HONDURAS_GEO.viewBox.split(' ').map(Number);

  return (
    <div className="relative">
      <svg viewBox={HONDURAS_GEO.viewBox} className="w-full" style={{ maxHeight: 400 }}>
        {Object.entries(HONDURAS_GEO.departamentos).map(([nombre, geo]) => {
          const info = datos.find(d => d.departamento === nombre) || { departamento: nombre, total: 0, municipios: [] };
          return (
            <path
              key={nombre}
              d={geo.path}
              fill={colorPara(info.total)}
              stroke="#FBF6EC"
              strokeWidth={1.5}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onMouseEnter={() => setHover({ ...info, x: geo.centroid[0], y: geo.centroid[1] })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {Object.entries(HONDURAS_GEO.departamentos).map(([nombre, geo]) => {
          const info = datos.find(d => d.departamento === nombre);
          if (!info?.total) return null;
          return (
            <text
              key={nombre + '-label'}
              x={geo.centroid[0]}
              y={geo.centroid[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="13"
              fontWeight="700"
              fill={info.total / maxTotal > 0.4 ? '#FBF6EC' : '#1B140E'}
              className="pointer-events-none"
            >
              {info.total}
            </text>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[160px] rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(hover.x / vbW) * 100}%`, top: `${(hover.y / vbH) * 100}%`, transform: 'translate(-50%, -115%)' }}
        >
          <p className="font-semibold text-ink">{hover.departamento}</p>
          <p className="text-ink/60">{hover.total} participante(s) · {totalGeneral ? Math.round((hover.total / totalGeneral) * 100) : 0}% del total</p>
          {hover.municipios?.length > 0 && (
            <ul className="mt-1 space-y-0.5 border-t border-ink/10 pt-1 text-ink/50">
              {hover.municipios.slice(0, 5).map(m => (
                <li key={m.municipio} className="flex justify-between gap-3">
                  <span>{m.municipio}</span><span className="font-medium">{m.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-xs text-ink/40">Pasa el mouse sobre cada departamento para ver el detalle por municipio</p>
    </div>
  );
}
