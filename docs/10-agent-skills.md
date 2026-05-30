# 10 — Agent skills

Instala workflows de agente (Cursor / Claude Code) para construir storefronts Proxima sin copiar markdown a mano.

---

## Instalación

Los skills vienen empaquetados en **`@proxima-io/cli`**:

```bash
npm install -g @proxima-io/cli

proxima skills list
proxima skills install
```

### Flags

| Flag | Efecto |
|------|--------|
| *(default)* | Instala en `.cursor/skills/` **y** `.claude/skills/` del cwd |
| `--cursor` | Solo Cursor |
| `--claude` | Solo Claude Code |
| `--global` / `-g` | `~/.cursor/skills/` y/o `~/.claude/skills/` |
| `--force` / `-f` | Sobrescribe skills ya instalados |
| `[skill...]` | Solo los nombres indicados (ej. `website-deploy add-section`) |

### Ejemplos

```bash
# Proyecto standalone Astro
cd mi-tienda
proxima skills install

# Solo deploy + wire CMS en Cursor
proxima skills install website-deploy wire-cms-sections --cursor

# Global para todos tus repos
proxima skills install --global
```

---

## Skills incluidos

| Skill | Descripción |
|-------|-------------|
| **website-deploy** | `proxima deploy`, credenciales, errores 403/409, deploy vs seed |
| **wire-cms-sections** | Auditar mismatch schema ↔ props, EditableAttribute, deploy |
| **add-section** | Nueva sección: componente, manifiesto, SECTION_REGISTRY |
| **new-storefront-app** | Scaffold app Astro single-tenant (patrón golden template) |
| **ecommerce-audit** | Auditoría UX/CRO priorizada |
| **seo** | SEO técnico y contenido para storefronts |
| **openspec-propose** | Proponer cambios OpenSpec (monorepo SDK) |
| **openspec-apply-change** | Implementar tareas OpenSpec |
| **openspec-explore** | Modo exploración antes de implementar |
| **openspec-archive-change** | Archivar change completado |

Los skills referencian la documentación de este repo (`docs/01-mental-model.md`, `07-cms-attribute-schema.md`, etc.) y el CLI `proxima`.

**Alcance:** los skills `new-storefront-app` y `ecommerce-audit` asumen el monorepo `proxima-storefronts` (`apps/*`). El resto aplica a cualquier storefront con `proxima.website.json` — adaptar rutas si el proyecto es standalone (sin prefijo `apps/{slug}/`).

---

## Cómo los usan los agentes

Cursor y Claude Code leen `SKILL.md` cuando la descripción del frontmatter coincide con la tarea del usuario (ej. "haz deploy del manifiesto" → `website-deploy`).

Convenciones:
- **Project skills** (`.cursor/skills/`): compartidos con el equipo vía git
- **Global skills** (`~/.cursor/skills/`): personales, todos los repos

Recomendación: en repos de cliente, commitear `.cursor/skills/` después de `proxima skills install` para que todo el equipo tenga los mismos workflows.

---

## Actualizar

```bash
npm update -g @proxima-io/cli
proxima skills install --force
```

---

## Relación con la documentación

| Necesidad | Doc | Skill |
|-----------|-----|-------|
| Modelo CMS completo | [01-mental-model](./01-mental-model.md) | wire-cms-sections, add-section |
| Schema Builder | [07-cms-attribute-schema](./07-cms-attribute-schema.md) | wire-cms-sections |
| Deploy | [09-deploy](./09-deploy.md) | website-deploy |
| Template marketplace | [08-template-authoring](./08-template-authoring.md) | new-storefront-app |

Ver también `packages/cli/skills/README.md` en el repo del SDK.
