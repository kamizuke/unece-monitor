# UNECE Regulatory Monitor

Web para vigilar cambios en reglamentos UNECE/WP.29 y generar evidencia de revisión para laboratorios con alcance ISO/IEC 17025.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Variables De Entorno

Opcionales en desarrollo, recomendadas en producción:

```bash
ADMIN_TOKEN=clave-interna-para-acciones-sensibles
GH_PAT=github-token-con-permiso-contents-y-actions
ANTHROPIC_API_KEY=clave-para-analisis-ia
```

También se acepta `GITHUB_PAT` como alias de `GH_PAT`.

Si `ADMIN_TOKEN` está configurado, las acciones sensibles de la UI pedirán la clave la primera vez:

- lanzar revisión manual
- guardar reglamentos vigilados
- activar/desactivar ejecución automática
- generar análisis IA

## Comandos

```bash
npm run build
npx tsc --noEmit
```

## Notas De Operación

Actualmente la configuración y los cambios publicados se leen desde `public/config.json`, `public/state.json` y `public/changes_log.json`. Esto es suficiente para una demo o una instalación controlada, pero para uso formal en auditoría conviene migrarlo a una base de datos con usuarios, roles y trazabilidad inmutable.

El scraper está en `scraper/monitor.py` y actualiza el estado comparando documentos detectados con hashes conocidos. Para producción conviene ampliar la fuente UNECE, guardar hash de PDF, fecha de publicación, versión/serie y evidencia descargada.
