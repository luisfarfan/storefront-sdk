import type { WebsiteDeployManifest } from '@proxima-io/template-schema';
import type { SmartCollectionPlaceholderDef, TemplateStructure } from '../types/template-structure.js';

export function buildTemplateStructure(manifest: WebsiteDeployManifest): TemplateStructure {
  const placeholders = (manifest.smart_collection_placeholders ?? {}) as Record<string, SmartCollectionPlaceholderDef>;
  const placeholderKeys = new Set(Object.keys(placeholders));

  function convertValue(value: unknown, fieldPath: string): unknown {
    if (typeof value === 'string' && value.startsWith('auto:')) {
      const key = value.slice('auto:'.length);
      if (!placeholderKeys.has(key)) {
        throw new Error(
          `smart_collection_id value '${value}' at '${fieldPath}' references auto key '${key}' ` +
          `which is not declared in smart_collection_placeholders. ` +
          `Add an entry for '${key}' in smart_collection_placeholders or use {"_smart_collection_placeholder": "${key}"}.`
        );
      }
      return { _smart_collection_placeholder: key };
    }
    if (typeof value === 'number') {
      if (fieldPath.toLowerCase().includes('smart_collection')) {
        throw new Error(
          `smart_collection_id value at '${fieldPath}' is a numeric ID (${value}). ` +
          `Templates must use {"_smart_collection_placeholder": "key"} or "auto:key" strings instead of raw IDs.`
        );
      }
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => convertValue(item, `${fieldPath}[${i}]`));
    }
    if (value && typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      if ('_smart_collection_placeholder' in rec) return rec;
      return Object.fromEntries(
        Object.entries(rec).map(([k, v]) => [k, convertValue(v, `${fieldPath}.${k}`)])
      );
    }
    return value;
  }

  const pages = manifest.pages.map((page) => {
    const sections = (page.scaffold_sections ?? []).map((scaffold, si) => {
      const rawValues = scaffold.values ?? scaffold.default_values ?? {};
      const fieldName = scaffold.values ? 'values' : 'default_values';
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawValues)) {
        values[k] = convertValue(v, `pages[${page.resolver_kind}].scaffold_sections[${si}].${fieldName}.${k}`);
      }
      return {
        name: scaffold.section_type,
        type: scaffold.section_type,
        order: scaffold.order ?? si,
        values,
      };
    });

    const pageEntry: Record<string, unknown> = {
      name: page.label ?? page.resolver_kind,
      path: page.path ?? `/{${page.resolver_kind}}`,
      resolver_kind: page.resolver_kind,
      has_params: !!(page.path ?? '').includes('{'),
      params: ((page.path ?? '').match(/\{([^}]+)\}/g) ?? []).map((m: string) => m.slice(1, -1)),
      order: 0,
      sections,
    };
    return pageEntry;
  });

  const shellDefaultValues = (manifest.shell_default_values ?? {}) as Record<string, Record<string, unknown>>;
  const shellSections = (manifest.shell_sections ?? []).map((shell) => {
    const slot = shell.key;
    const rawValues = shell.values ?? shellDefaultValues[slot] ?? {};
    const fieldPath = shell.values
      ? `shell_sections[${slot}].values`
      : `shell_default_values.${slot}`;
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawValues)) {
      values[k] = convertValue(v, `${fieldPath}.${k}`);
    }
    return {
      slot,
      section_type: shell.section_type ?? slot,
      name: shell.label ?? slot.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      order: shell.order ?? 0,
      values,
    };
  });

  return {
    shell_sections: shellSections,
    smart_collection_placeholders: placeholders,
    pages,
    layouts: [],
  };
}

export function buildManifestPublishBody(manifest: WebsiteDeployManifest): Record<string, unknown> {
  const shellDefaultValues = (manifest.shell_default_values ?? {}) as Record<string, Record<string, unknown>>;

  return {
    section_types: manifest.section_types,
    pages: manifest.pages.map((page) => ({
      resolver_kind: page.resolver_kind,
      ...(page.path !== undefined && { path: page.path }),
      ...(page.label !== undefined && { label: page.label }),
      scaffold_sections: (page.scaffold_sections ?? []).map((sc) => ({
        section_type: sc.section_type,
        order: sc.order ?? 0,
        values: sc.values ?? sc.default_values ?? {},
      })),
    })),
    shell_sections: (manifest.shell_sections ?? []).map((sh) => ({
      key: sh.key,
      ...(sh.section_type !== undefined && { section_type: sh.section_type }),
      ...(sh.label !== undefined && { label: sh.label }),
      order: sh.order ?? 0,
      values: sh.values ?? shellDefaultValues[sh.key] ?? {},
    })),
    smart_collection_placeholders: manifest.smart_collection_placeholders ?? {},
  };
}
