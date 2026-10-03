import type { Generated } from 'kysely';
import type { SectionSource } from './sections/types.ts';
import type { WidgetType } from './widgets/types.ts';
/** Owned Source-shaped storage fields; canonical CmsTables and migrations remain unchanged. */
export interface Database {
  _cms_section_categories: { id: string; slug: string; label: string; sort_order: Generated<number>; created_at: Generated<string> };
  _cms_sections: {
    id: string; slug: string; title: string; description: string | null; category_id: string | null;
    keywords: string | null; content: string; preview_media_id: string | null;
    source: Generated<SectionSource>; theme_id: string | null; created_at: Generated<string>; updated_at: Generated<string>;
  };
  _cms_widget_areas: { id: string; name: string; label: string; description: string | null; created_at: Generated<string> };
  _cms_widgets: {
    id: string; area_id: string; sort_order: Generated<number>; type: WidgetType;
    title: string | null; content: string | null; menu_name: string | null;
    component_id: string | null; component_props: string | null; created_at: Generated<string>;
  };
  _cms_media: { id: string; storage_key: string };
}
