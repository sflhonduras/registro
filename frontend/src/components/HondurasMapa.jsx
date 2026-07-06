import { useMemo, useState } from 'react';

// Posiciones aproximadas (no geográficamente exactas, pero respetan la disposición
// relativa real de los 18 departamentos de Honduras) en una cuadrícula.
const POSICIONES = {
  'Islas de la Bahía': [8, 0],
  'Atlántida': [5, 0],
  'Colón': [7.2, 0.3],
  'Cortés': [3, 1],
  'Yoro': [5.2, 1.2],
  'Gracias a Dios': [9.2, 1.3],
  'Copán': [1, 2],
  'Santa Bárbara': [3, 2.1],
  'Comayagua': [4.8, 2.3],
  'Olancho': [7.3, 2.2],
  'Ocotepeque': [0, 3],
  'Lempira': [1.6, 3],
  'Intibucá': [3, 3.2],
  'Francisco Morazán': [5, 3.3],
  'El Paraíso': [7.2, 3.4],
  'La Paz': [3.2, 4.2],
  'Choluteca': [3.4, 5.2],
  'Valle': [4.8, 5],
};

const CELDA = 62;
const MARGEN = 46;

function coordenadas(dep) {
  const [col, fila] = POSICIONES[dep] || [0, 0];
  return { x: col * CELDA + MARGEN, y: fila * CELDA + MARGEN };
}

export default function HondurasMapa({ datos }) {
  const [hover, setHover] = useState(null);

  const maxTotal = useMemo(() => Math.max(1, ...datos.map(d => d.total)), [datos]);
  const totalGeneral = useMemo(() => datos.reduce((s, d) => s + d.total, 0), [datos]);

  const anchoSvg = 10.5 * CELDA + MARGEN * 2;
  const altoSvg = 6 * CELDA + MARGEN * 2;

  const colorPara = (total) => {
    const intensidad = total / maxTotal; // 0 a 1
    // Interpola de dorado pálido a ember (rojo vino) según intensidad
    const r1 = 231, g1 = 184, b1 = 92;   // gold-light
    const r2 = 178, g2 = 58, b2 = 46;    // ember
    const r = Math.round(r1 + (r2 - r1) * intensidad);
    const g = Math.round(g1 + (g2 - g1) * intensidad);
    const b = Math.round(b1 + (b2 - b1) * intensidad);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} className="w-full" style={{ maxHeight: 360 }}>
        {Object.keys(POSICIONES).map(dep => {
          const info = datos.find(d => d.departamento === dep) || { departamento: dep, total: 0, municipios: [] };
          const { x, y } = coordenadas(dep);
          const radio = 14 + 22 * Math.sqrt(info.total / maxTotal || 0);
          return (
            <g
              key={dep}
              onMouseEnter={() => setHover({ ...info, x, y })}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              <circle cx={x} cy={y} r={radio} fill={colorPara(info.total)} stroke="#1B140E" strokeOpacity={0.15} strokeWidth={1.5} />
              <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontSize={info.total > 0 ? 11 : 9}
                fontWeight="700" fill={info.total / maxTotal > 0.45 ? '#FBF6EC' : '#1B140E'}>
                {info.total || ''}
              </text>
              <text x={x} y={y + radio + 11} textAnchor="middle" fontSize="8.5" fill="#1B140E" opacity={0.65}>
                {dep.length > 12 ? dep.split(' ')[0] : dep}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[160px] rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(hover.x / anchoSvg) * 100}%`, top: `${(hover.y / altoSvg) * 100}%`, transform: 'translate(-50%, -115%)' }}
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
