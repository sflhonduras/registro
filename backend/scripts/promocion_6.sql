INSERT INTO configuracion (clave, valor, actualizado_en) VALUES ('promocion_actual','6',now())
ON CONFLICT (clave) DO UPDATE SET valor='6', actualizado_en=now();
SELECT valor FROM configuracion WHERE clave='promocion_actual';
