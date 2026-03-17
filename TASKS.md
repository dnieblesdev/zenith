# Tareas Pendientes

## Prioridad Baja

### Task: [FEATURE] Logout forzado de usuarios (Admin)

**Descripción:**
Agregar funcionalidad en el panel de admin para cerrar sesiones de usuarios de forma forzada. Permite revocar una sesión específica o todas las sesiones de un usuario.

**Estado actual:**
- No implementado

**Funcionalidad esperada:**
- [ ] Admin puede ver sesiones activas de un usuario
- [ ] Admin puede revocar una sesión específica
- [ ] Admin puede revocar todas las sesiones de un usuario (logout forzado)
- [ ] El usuario afectado pierde acceso inmediatamente

**Notas técnicas:**
- Usar Better Auth API: `auth.api.revokeSession()`
- Endpoint en `zenith-api/src/routes/admin.ts`
- UI en `zenith-web/src/app/features/admin/`

**Prioridad:** Low - Nice to have para el panel de admin
