/**
 * Renders the shared block model as HTML.
 *
 * The same `ArticleBlock[]` the iOS app renders natively, so the web version of
 * an issue is the same content and cannot drift from it.
 */

import type { ArticleBlock, TextRun } from '@climatenote/shared';

import { imageUrl } from '@/lib/supabase';

function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        if (run.href) {
          return (
            <a key={index} href={run.href} rel="noopener noreferrer">
              {run.text}
            </a>
          );
        }
        if (run.bold) return <strong key={index}>{run.text}</strong>;
        if (run.italic) return <em key={index}>{run.text}</em>;
        return <span key={index}>{run.text}</span>;
      })}
    </>
  );
}

export function ArticleBlocks({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="prose">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2 key={index}>
                <Runs runs={block.runs} />
              </h2>
            ) : (
              <h3 key={index}>
                <Runs runs={block.runs} />
              </h3>
            );

          case 'paragraph':
            return (
              <p key={index}>
                <Runs runs={block.runs} />
              </p>
            );

          case 'quote':
            return (
              <blockquote key={index}>
                <Runs runs={block.runs} />
                {block.attribution ? <footer className="small">{block.attribution}</footer> : null}
              </blockquote>
            );

          case 'list':
            return block.ordered ? (
              <ol key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Runs runs={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Runs runs={item} />
                  </li>
                ))}
              </ul>
            );

          case 'image':
            return (
              <figure key={index} style={{ margin: '2em 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(block.storagePath)} alt={block.alt} loading="lazy" />
                {block.caption ? (
                  <figcaption className="small">{block.caption}</figcaption>
                ) : null}
              </figure>
            );

          case 'divider':
            return (
              <hr
                key={index}
                style={{ border: 0, borderTop: '1px solid var(--border)', margin: '2.5em auto', width: 64 }}
              />
            );
        }
      })}
    </div>
  );
}
