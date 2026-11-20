/** Holding page while a section of the rework is being built. */
import { Hammer } from '@phosphor-icons/react';
import { EmptyState, PageHeader } from '../../ui/index.js';

export default function Soon({ title, line = 'This part of the new site is being built right now.' }) {
  return (
    <div className="ui-page">
      <PageHeader title={title} />
      <EmptyState icon={Hammer}>{line}</EmptyState>
    </div>
  );
}
