# Safety Report App - Reportes de Actos y Condiciones Inseguras

Aplicación PWA para reportar actos y condiciones inseguras en empresas, con un enfoque simple basado en captura fotográfica y gestión visual.

## Características Principales

- **Vista de Cámara**: Interfaz intuitiva para capturar fotos de situaciones inseguras
- **Múltiples Fotos por Reporte**: Captura varias fotos para documentar mejor cada incidente
- **Geolocalización Automática**: Captura la ubicación GPS donde se toma la foto
- **Flujo Simplificado**: Proceso guiado tipo overlay sobre la foto capturada
- **Roles y Permisos**: Sistema robusto con 5 roles diferentes
- **Galería Adaptativa**: Vista que cambia según el rol del usuario
- **PWA Instalable**: Se puede instalar en el dispositivo como app nativa
- **Notificaciones**: Sistema de notificaciones para cambios de estado
- **RLS Seguro**: Políticas de seguridad a nivel de base de datos

## Roles del Sistema

### 1. Trabajador (Worker)
- Puede tomar fotos y crear reportes
- Ve solo sus propios reportes en modo lectura
- Pantalla principal: Cámara

### 2. Responsable (Responsible)
- Puede crear reportes
- Ve reportes que le han sido asignados
- Puede subir evidencias de ejecución
- Puede marcar reportes como ejecutados

### 3. Gestor SST (SST Manager)
- Puede crear reportes
- Ve todos los reportes de la empresa
- Asigna responsables a reportes
- Cambia prioridades
- Valida evidencias y cierra reportes
- Gestiona usuarios de la empresa

### 4. RRHH/Observador (HR Observer)
- Puede crear reportes
- Ve todos los reportes en modo solo lectura
- Acceso a métricas y estadísticas

### 5. Super Admin
- Gestiona empresas y planes
- Crea gestores SST
- Puede entrar a cualquier empresa

## Estados de Reportes

1. **Reportado**: Reporte recién creado
2. **Asignado**: Gestor SST asignó un responsable
3. **En Ejecución**: Responsable comenzó el trabajo
4. **Ejecutado**: Responsable subió evidencia de corrección
5. **Rechazado**: Gestor SST rechazó la evidencia (vuelve a En Ejecución)
6. **Cerrado**: Gestor SST validó y cerró el reporte

## Configuración

### Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### Base de Datos

La aplicación usa Supabase como backend. Las migraciones ya están aplicadas e incluyen:

- Tablas: companies, users, categories, reports, report_photos, report_history
- Storage buckets para fotos y notas de voz
- Row Level Security (RLS) configurado
- Funciones y triggers automáticos

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Build para Producción

```bash
npm run build
```

## Uso

### Crear el Primer Usuario

1. El Super Admin debe crear la primera empresa
2. Crear un usuario Gestor SST para esa empresa
3. El Gestor SST puede crear los demás usuarios

### Credenciales por Defecto

- Email o DNI para login
- Contraseña por defecto: el DNI del usuario

### Flujo de Reporte

1. **Capturar Foto(s)**: Usa la cámara o selecciona desde galería
2. **Tipo**: Selecciona Acto o Condición Insegura
3. **Categoría**: Elige una categoría predefinida
4. **Descripción**: Describe lo observado (texto)
5. **Propuesta**: Sugiere una forma de solución
6. **Enviar**: El reporte se crea automáticamente

### Gestión de Reportes (SST Manager)

1. Ver todos los reportes en la galería
2. Hacer clic en un reporte para ver detalles
3. Asignar responsable usando el botón superior derecho
4. El responsable recibe notificación
5. Seguir el estado hasta el cierre

## Estructura del Proyecto

```
src/
├── components/
│   ├── auth/          # Componentes de autenticación
│   ├── camera/        # Vista de cámara y flujo de reportes
│   ├── gallery/       # Tarjetas y modales de reportes
│   ├── common/        # Componentes reutilizables
│   └── layout/        # Layout principal de la app
├── contexts/          # Context API (Auth)
├── hooks/             # Custom hooks (Geolocation)
├── lib/               # Cliente de Supabase
├── pages/             # Páginas principales
├── types/             # TypeScript types
└── utils/             # Funciones utilitarias
```

## PWA

La aplicación está configurada como PWA:

- Manifest configurado para instalación
- Service Worker para cache
- Funciona offline (limitado)
- Iconos y splash screens
- Compatible con Android e iOS

## Seguridad

- Row Level Security en todas las tablas
- Políticas basadas en roles y empresa
- Autenticación con Supabase Auth
- Contraseñas hasheadas
- Storage con políticas restrictivas

## Próximas Funcionalidades

- ✅ Integración con OpenAI para sugerencias automáticas
- ✅ Grabación de notas de voz
- ✅ Notificaciones push
- ✅ Dashboard de métricas avanzado
- ✅ Exportación de reportes a PDF/Excel
- ✅ Sistema de recordatorios

## Tecnologías

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase (Base de datos, Auth, Storage)
- React Router
- Vite PWA Plugin
- Lucide Icons

## Licencia

Privado - Todos los derechos reservados
