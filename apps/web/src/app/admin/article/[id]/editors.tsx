'use client';

import { useState, useTransition } from 'react';

import {
  publishArticle,
  saveArticleLink,
  unpublishArticle,
  updateReflectionOption,
  updateSummary,
} from '../../actions';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--text-primary)',
  font: 'inherit',
  fontSize: 15,
};

function Status({ message }: { message: string | null }) {
  if (!message) return null;
  const failed = message.startsWith('Could not');
  return (
    <p className="small" style={{ margin: '8px 0 0', color: failed ? '#b4553c' : 'var(--brand)' }}>
      {message}
    </p>
  );
}

/** Publish / unpublish, plus a link to see the live page. */
export function ArticleControls({
  articleId,
  status,
  slug,
}: {
  articleId: string;
  status: string;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {status === 'published' ? (
          <>
            <a className="button button--secondary" href={`/read/${slug}`}>
              View live
            </a>
            <button
              type="button"
              className="button button--danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await unpublishArticle(articleId);
                  setMessage(result.ok ? 'Unpublished.' : `Could not unpublish: ${result.error}`);
                })
              }
            >
              Unpublish
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await publishArticle(articleId);
                setMessage(result.ok ? 'Published.' : `Could not publish: ${result.error}`);
              })
            }
          >
            {pending ? 'Publishing…' : 'Publish this issue'}
          </button>
        )}
      </div>
      <Status message={message} />
    </div>
  );
}

export function SummaryEditor({
  articleId,
  summary,
}: {
  articleId: string;
  summary: {
    problem: string;
    why_it_matters: string;
    what_we_can_do: string[];
    edited_by_admin: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="card"
      action={(formData) =>
        startTransition(async () => {
          const result = await updateSummary(articleId, formData);
          setMessage(result.ok ? 'Saved.' : `Could not save: ${result.error}`);
        })
      }
    >
      <label className="small" htmlFor="problem">
        What is going wrong
      </label>
      <textarea id="problem" name="problem" rows={4} defaultValue={summary.problem} style={inputStyle} />

      <label className="small" htmlFor="why" style={{ display: 'block', marginTop: 12 }}>
        Why it matters
      </label>
      <textarea
        id="why"
        name="why_it_matters"
        rows={4}
        defaultValue={summary.why_it_matters}
        style={inputStyle}
      />

      <label className="small" htmlFor="actions" style={{ display: 'block', marginTop: 12 }}>
        What can be done — one per line
      </label>
      <textarea
        id="actions"
        name="what_we_can_do"
        rows={4}
        defaultValue={summary.what_we_can_do.join('\n')}
        style={inputStyle}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button type="submit" className="button button--secondary" disabled={pending}>
          {pending ? 'Saving…' : 'Save summary'}
        </button>
        {summary.edited_by_admin ? (
          <span className="small">Edited by hand — a re-run will not overwrite this.</span>
        ) : null}
      </div>
      <Status message={message} />
    </form>
  );
}

export function OptionEditor({
  option,
}: {
  option: { id: string; position: number; title: string; detail: string };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updateReflectionOption(option.id, formData);
          setMessage(result.ok ? 'Saved.' : `Could not save: ${result.error}`);
        })
      }
    >
      <label className="small" htmlFor={`title-${option.id}`}>
        Option {option.position}
      </label>
      <input
        id={`title-${option.id}`}
        name="title"
        defaultValue={option.title}
        style={{ ...inputStyle, fontWeight: 600 }}
      />
      <textarea
        name="detail"
        rows={2}
        defaultValue={option.detail}
        style={{ ...inputStyle, marginTop: 8 }}
      />
      <button
        type="submit"
        className="button button--secondary"
        disabled={pending}
        style={{ marginTop: 8, minHeight: 36, fontSize: 14 }}
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <Status message={message} />
    </form>
  );
}

const PLATFORMS = ['instagram', 'substack', 'medium', 'youtube', 'other'] as const;

/**
 * The manual cross-posting links.
 *
 * One field per platform, saved independently. Clearing a field removes that
 * link, which is the obvious way to expect it to work.
 */
export function LinkEditor({
  articleId,
  links,
}: {
  articleId: string;
  links: { platform: string; url: string; label: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="card">
      {PLATFORMS.map((platform) => {
        const existing = links.find((link) => link.platform === platform);

        return (
          <form
            key={platform}
            action={(formData) =>
              startTransition(async () => {
                const result = await saveArticleLink(articleId, formData);
                setMessage(result.ok ? 'Saved.' : `Could not save: ${result.error}`);
              })
            }
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
          >
            <input type="hidden" name="platform" value={platform} />
            <span className="small" style={{ width: 90, textTransform: 'capitalize' }}>
              {platform}
            </span>
            <input
              name="url"
              type="url"
              placeholder="https://…"
              defaultValue={existing?.url ?? ''}
              style={{ ...inputStyle, flex: 1 }}
              aria-label={`${platform} link`}
            />
            <button
              type="submit"
              className="button button--secondary"
              disabled={pending}
              style={{ minHeight: 40, fontSize: 14 }}
            >
              Save
            </button>
          </form>
        );
      })}
      <Status message={message} />
    </div>
  );
}
