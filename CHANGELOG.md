# Historial de versiones — Sistema SFL FIHNEC

## v1.4.0 — 4 de septiembre de 2026
- Auditoría del panel: las acciones sobre un participante (marcar Registrado, editar,
  eliminar, etc.) ahora muestran el nombre completo y el DNI de esa persona directo en el
  detalle, en vez de solo su ID — ya no hace falta ir a Neon a traducir el ID a un nombre

## v1.3.1 — 4 de septiembre de 2026
- Corregido bug real: "Exportar lista para llamadas" dejaba descargar el Excel en
  producción aunque nadie estuviera registrado físicamente — el navegador estaba
  reutilizando una respuesta vieja guardada en caché (Status 304) en vez de consultar al
  servidor de nuevo. Se agregó "cache: no-store" en el frontend y el encabezado
  "Cache-Control: no-store" en el backend, para que esta respuesta nunca quede guardada

## v1.3.0 — 3 de septiembre de 2026
- Panel administrativo: nuevo navbar fijo arriba (iniciales, nombre, rol, logo, menú de
  engranaje con Vista horizontal/vertical, Sitio Principal y Olvidar Dispositivos
  Confiables) — y una nueva vista horizontal (menú agrupado por categorías, se despliega al
  pasar el mouse) como alternativa al sidebar clásico, elegible por cada usuario
- 2FA: nuevo sistema de "dispositivo confiable" — ya no pide el código cada vez que entras
  desde el mismo navegador, solo cada 7 días o si es un navegador nuevo; botón para "olvidar"
  todos los dispositivos de golpe
- Nuevo módulo: Registro en Vivo — enlace público (sin login, vence solo a las 72 horas) con
  el conteo de participantes en tiempo real y el mapa de Honduras clicable, con desglose de
  cargos en FIHNEC por departamento; accesible desde una tarjeta nueva en el Dashboard
- Corregido bug real en "Exportar lista para llamadas": exportaba a todos los inscritos en
  vez de solo a los registrados físicamente (misma población que Diplomas)
- La tarjeta "Exportar lista para llamadas" se mudó de Participantes a Reportería
- Participantes: la tabla ahora resalta a los ya registrados, los ordena al final de la
  lista automáticamente, y muestra un mensaje de confirmación breve al marcar/desmarcar a
  alguien
- Diplomas, Participantes Sin Requisitos y las tarjetas de Estadísticas generales: color
  consistente en botones, tablas y tarjetas en toda la paleta de marca
- Eventos ahora es exclusivo del Súper Administrador (antes cualquier admin con el permiso
  concedido podía entrar)
- Corregido bug real de datos viejos: los números del panel (Inscritos/Registrados/Sin
  Requisitos/TP) ahora se refrescan solos al navegar o al marcar/desmarcar a alguien, en vez
  de quedarse con el dato de cuando entraste al panel

## v1.2.0 — 19 de agosto de 2026
- Módulo de cumpleaños en el Portal del Servidor: pantalla de celebración de pantalla
  completa el día exacto, más 4 efectos ambientales sutiles durante todo el mes
  (confeti, cajas de regalo, destellos, globos) y badge en la credencial
- Versículos bíblicos rotativos: banco general (todos, cada día) y banco especial de
  cumpleaños, con rotación automática por fecha — sin tarea programada
- Diplomas: el conteo ahora suma Participantes Sin Requisitos del mismo nivel/ciclo al
  total, sin afectar las exportaciones (Excel/PDF/Imprimir)
- Panel lateral: desglose "Inscritos | Registrados" (con el detalle de cuántos son
  Con y Sin Requisitos), reemplaza el contador único anterior
- Reportería: nueva opción para incluir Participantes Sin Requisitos del nivel/ciclo
  actual en cualquier reporte, con secciones separadas y total general
- Nuevo módulo: Informes de Cierre de Nivel — se genera automáticamente al cambiar
  cuál nivel es el actual; página pública (enlace permanente, sin login) con KPIs,
  perfil demográfico, mapa de Honduras, y descarga como PPTX con diseño de marca,
  pensado para compartir con la Junta Directiva de FIHNEC
- Deserción: nuevo criterio basado en fecha de graduación individual (antes esperaba
  el cierre de todo el ciclo) — aplicado en Estadísticas generales, Reportería y el
  Informe de Cierre, para que las 3 pantallas siempre coincidan
- Nueva dependencia de backend: pptxgenjs (generación de PowerPoint)

## v1.1.0 — 13 de agosto de 2026
- Módulo "Participantes Sin Requisitos": registro manual de asistentes sin cumplir el
  requisito previo (extranjeros o casos atípicos incluidos), verificación de identidad
  existente, seguimiento de niveles con evidencia real, traslado autorizado a Participantes
- Días de asistencia por servidor (Viernes/Sábado/Domingo), con interruptor maestro
  "Participará en el evento" y reinicio masivo por ciclo
- Departamento y Municipio agregados a Servidores SFL (formulario, reportes y ficha)
- Portal del Servidor — nuevo portal público (DNI + PIN): panel de estadísticas
  personales, gestión de días de asistencia y datos de contacto, transporte (unirse/salir
  de un vehículo), inventario (solo para categorías asignadas como responsable), con
  diseño de marca propio
- Historial de participación de servidores por ciclo (arranca a partir de esta versión)
- Refuerzo de seguridad del PIN: bloqueo tras 3 intentos fallidos (30 min), cambio de PIN
  obligatorio en el primer ingreso — aplica tanto a Participantes como a Servidores
- PIN oculto en el panel — solo Administrador y Super Administrador pueden verlo o
  regenerarlo
- Recordatorio de cambio de contraseña cada 90 días para usuarios del panel (excepto
  Super Administrador)
- Reporte PDF de Servidores rediseñado (mismo estilo de marca que la Ficha individual)
- Autocompletado del navegador deshabilitado en todos los formularios de acceso

## v1.0.0 — 9 de agosto de 2026
- Sistema de 2FA (doble autenticación) configurable por usuario, obligatorio para Super Administrador
- Portal de autoconsulta público (DNI + PIN): estatus, código QR, medallas
- Escaneo de QR desde el panel para marcar asistencia
- Mejoras al mapa de Estadísticas: clic para filtrar, exportar como imagen, 4 vistas (histórico, ciclo actual, por nivel, deserción)
- Papelera: cualquier eliminación se puede restaurar
- Restaurar desde respaldo (modo aditivo y modo reemplazo completo, con PIN de seguridad)
- Sistema de permisos dinámico por módulo, para todos los roles
- Ajustes en Servidores: foto, fechas, checkboxes de testimonio, edad en cumpleaños
