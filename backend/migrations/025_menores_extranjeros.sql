-- 025_menores_extranjeros.sql
-- Permite registrar EXTRANJEROS (con pasaporte) y MENORES de edad (sin DNI) en el SFL.
-- No toca datos existentes: todos los participantes actuales quedan como 'nacional' con DNI.
-- Antes de correr: haz un respaldo desde Panel > Mantenimiento.
-- Se aplica con:  node scripts/aplicar_una_migracion.js 025_menores_extranjeros.sql

ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tipo_participante TEXT NOT NULL DEFAULT 'nacional';
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS tipo_identificacion TEXT NOT NULL DEFAULT 'DNI';
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participantes_tipo_participante_check') THEN
    ALTER TABLE participantes
      ADD CONSTRAINT participantes_tipo_participante_check
      CHECK (tipo_participante IN ('nacional', 'extranjero', 'menor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participantes_tipo_identificacion_check') THEN
    ALTER TABLE participantes
      ADD CONSTRAINT participantes_tipo_identificacion_check
      CHECK (tipo_identificacion IN ('DNI', 'Pasaporte', 'Código interno'));
  END IF;
END $$;

-- Contador de códigos internos para menores sin DNI (MEN-00001, MEN-00002…).
CREATE SEQUENCE IF NOT EXISTS menores_codigo_seq START 1;
