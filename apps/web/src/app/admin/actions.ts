'use server';

/**
 * Admin mutations.
 *
 * Every action re-checks the caller is an admin. Server Actions are reachable
 * by anyone who can construct the request, so the check on the page that
 * rendered the form is not sufficient — it has to happen here too.
 */

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { adminClient } from '@/lib/supabase';

export async function publishArticle(articleId: string) {
  await requireAdmin();
  const supabase = adminClient();

  const { data: article } = await supabase
    .from('articles')
    .select('id, published_at, article_assets (source_url, credit, license)')
    .eq('id', articleId)
    .single();

  // Refuse to publish an externally sourced image without attribution. The
  // database enforces this too, but failing here gives the editor a sentence
  // they can act on instead of a constraint violation.
  const assets = (article?.article_assets ?? []) as {
    source_url: string | null;
    credit: string | null;
    license: string | null;
  }[];
  const unattributed = assets.find((a) => a.source_url && (!a.credit || !a.license));
  if (unattributed) {
    return { ok: false as const, error: 'An image is missing its credit or licence.' };
  }

  const { error } = await supabase
    .from('articles')
    .update({
      status: 'published',
      // Keep the original date if this is a republish, so an edit does not
      // shuffle a back issue to the top of the feed.
      published_at: article?.published_at ?? new Date().toISOString(),
    })
    .eq('id', articleId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/');
  revalidatePath('/read');
  revalidatePath('/admin');
  return { ok: true as const };
}

export async function unpublishArticle(articleId: string) {
  await requireAdmin();
  const { error } = await adminClient()
    .from('articles')
    .update({ status: 'draft' })
    .eq('id', articleId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true as const };
}

export async function updateSummary(articleId: string, formData: FormData) {
  await requireAdmin();

  const whatWeCanDo = String(formData.get('what_we_can_do') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const { error } = await adminClient()
    .from('article_summaries')
    .update({
      problem: String(formData.get('problem') ?? ''),
      why_it_matters: String(formData.get('why_it_matters') ?? ''),
      what_we_can_do: whatWeCanDo,
      // Marks the row as human-edited so a re-run does not silently overwrite
      // an editor's corrections with fresh model output.
      edited_by_admin: true,
    })
    .eq('article_id', articleId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/article/${articleId}`);
  return { ok: true as const };
}

export async function updateReflectionOption(optionId: string, formData: FormData) {
  await requireAdmin();

  const { error } = await adminClient()
    .from('reflection_options')
    .update({
      title: String(formData.get('title') ?? ''),
      detail: String(formData.get('detail') ?? ''),
    })
    .eq('id', optionId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

/**
 * Records where an issue was also posted.
 *
 * This is the manual cross-posting the brief asked about: one row per platform,
 * upserted so re-saving the same platform edits rather than duplicates.
 */
export async function saveArticleLink(articleId: string, formData: FormData) {
  await requireAdmin();

  const platform = String(formData.get('platform') ?? '');
  const url = String(formData.get('url') ?? '').trim();

  if (!url) {
    // Empty URL means "remove this link", which is the natural way to clear it.
    await adminClient()
      .from('article_links')
      .delete()
      .eq('article_id', articleId)
      .eq('platform', platform);
    revalidatePath(`/admin/article/${articleId}`);
    return { ok: true as const };
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false as const, error: 'Links must start with http:// or https://' };
  }

  const { error } = await adminClient().from('article_links').upsert(
    {
      article_id: articleId,
      platform,
      url,
      label: String(formData.get('label') ?? '') || null,
    },
    { onConflict: 'article_id,platform' },
  );

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/article/${articleId}`);
  revalidatePath(`/read`, 'layout');
  return { ok: true as const };
}

/**
 * Triggers the ingestion worker without waiting for the cron.
 *
 * Fires a repository_dispatch at GitHub Actions, where the pipeline lives. The
 * token needs only "Contents: read and write" on this repository.
 */
export async function runIngestionNow() {
  await requireAdmin();

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!token || !repository) {
    return { ok: false as const, error: 'GITHUB_DISPATCH_TOKEN or GITHUB_REPOSITORY is not set.' };
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ event_type: 'ingest-now' }),
  });

  if (!response.ok) {
    return { ok: false as const, error: `GitHub returned ${response.status}` };
  }

  return { ok: true as const };
}
