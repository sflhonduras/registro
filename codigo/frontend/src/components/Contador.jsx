import { useEffect, useState } from 'react';

function calcularRestante(fechaObjetivo) {
  const diferencia = new Date(fechaObjetivo).getTime() - Date.now();
  if (diferencia <= 0) return null;
  const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diferencia / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diferencia / (1000 * 60)) % 60);
  return { dias, horas, minutos };
}

export default function Contador({ fechaObjetivo, etiqueta }) {
  const [restante, setRestante] = useState(() => calcularRestante(fechaObjetivo));

  useEffect(() => {
    if (!fechaObjetivo) return;
    const intervalo = setInterval(() => setRestante(calcularRestante(fechaObjetivo)), 60000);
    return () => clearInterval(intervalo);
  }, [fechaObjetivo]);

  if (!fechaObjetivo || !restante) return null;

  return (
    <div className="mt-6 inline-flex flex-col items-center gap-2">
      {etiqueta && <p className="text-xs uppercase tracking-widest text-parchment/50">{etiqueta}</p>}
      <div className="flex items-center gap-3">
        {[
          { valor: restante.dias, texto: 'días' },
          { valor: restante.horas, texto: 'horas' },
          { valor: restante.minutos, texto: 'min' },
        ].map((u, i) => (
          <div key={i} className="flex flex-col items-center rounded-xl border border-gold/25 bg-gold/5 px-4 py-2 min-w-[64px]">
            <span className="font-display text-2xl font-bold text-gold-light">{String(u.valor).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wide text-parchment/50">{u.texto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
