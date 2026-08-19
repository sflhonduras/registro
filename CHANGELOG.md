# Historial de versiones — Sistema SFL FIHNEC

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
