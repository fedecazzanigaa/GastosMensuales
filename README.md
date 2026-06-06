# Gastos Mensuales

Gastos Mensuales es una aplicación web ligera diseñada para hacer el seguimiento de los gastos familiares de forma rápida, clara e intuitiva.

## Descripción

Permite registrar gastos diarios, revisar balances mensuales, generar reportes y monitorear deudas con tarjeta. Está orientada a familias o grupos de personas que desean tener control de sus finanzas personales sin complicaciones.

## Características principales

- Panel de resumen con los gastos totales.
- Gráficos de distribución por categoría.
- Registro de nuevos gastos con fecha, categoría, persona y monto.
- Historial de gastos con filtros por categoría, persona y mes.
- Reportes descargables en formatos compatibles con Excel y PDF.
- Gestión de deudas en cuotas con tarjeta.
- Configuración de categorías de gasto personalizada.

## Estructura del proyecto

- `index.html` — Interfaz y estructura de la aplicación.
- `styles.css` — Estilos visuales y diseño responsivo.
- `app.js` — Lógica principal de la aplicación.
- `manifest.json` — Metadatos de la aplicación.
- `icons/` — Iconos utilizados en la UI.

## Requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge).
- No requiere servidor ni instalación de paquetes adicionales para correr localmente.

## Instalación y puesta en marcha

1. Clona el repositorio o descarga los archivos.

```bash
git clone https://github.com/fedecazzanigaa/GastosMensuales.git
cd GastosMensuales
```

2. Abre `index.html` directamente en el navegador.

> Nota: si prefieres usar un servidor local, también puedes iniciar uno con Python:
>
> ```bash
> python3 -m http.server 8000
> ```
>
> Luego visita `http://localhost:8000`.

## Uso

1. Navega hasta el panel principal para ver el resumen de gastos.
2. Usa la sección "Nuevo Gasto" para registrar un gasto con fecha, categoría, persona y monto.
3. Revisa el historial para filtrar gastos por persona, categoría o mes.
4. Genera reportes mensuales en Excel o PDF según lo necesites.
5. Registra deudas con tarjeta en la sección correspondiente para controlar cuotas.
6. Configura nuevas categorías de gasto en la sección de configuración.

## Contribuir

Si deseas mejorar la aplicación:

1. Crea un fork del repositorio.
2. Crea una rama nueva para tu función o corrección.
3. Envía un pull request con los cambios y una breve descripción.

